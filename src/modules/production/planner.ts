import {
  layingRate,
  PRODUCTIVE_WEEKS,
  SEASON_WEEKS,
  WEEKS_TO_LAY,
  type CurveParams,
  type Model,
} from './curve'

/** Mortalidad semanal típica en un galpón sano. */
const WEEKLY_MORTALITY = 0.0015

/** Los lotes se compran de 100 en adelante, en múltiplos de 50. */
export const MIN_LOT = 100
export const LOT_STEP = 50

export type PlannedLot = {
  id: string
  code: string
  /** Semanas en galpón al inicio de la proyección. Negativo si aún no llega. */
  ageWeeks: number
  hens: number
  /** Semana de la proyección en la que sale del galpón. */
  exitsAtWeek: number | null
  /** Los lotes que propone el planificador, contra los que ya existen. */
  proposed?: boolean
}

/** Semana del año en la que arranca la proyección, para leer la estacionalidad. */
export type Calendar = { firstWeekOfYear: number }

export type WeekProjection = {
  week: number
  /** Huevos de esa semana, por lote. */
  byLot: Record<string, number>
  total: number
  hens: number
}

/**
 * Proyecta la producción semana a semana.
 *
 * Cada lote aporta según su edad, envejece, pierde algunas aves por mortalidad
 * y deja de aportar cuando sale. La suma es la curva quebrada que el negocio
 * ve todas las semanas sin saber de dónde viene.
 */
export function project(
  lots: PlannedLot[],
  model: Model,
  weeks: number,
  calendar: Calendar = { firstWeekOfYear: 0 },
): WeekProjection[] {
  const out: WeekProjection[] = []
  const params: CurveParams = model.params

  for (let week = 0; week < weeks; week++) {
    const byLot: Record<string, number> = {}
    let total = 0
    let hens = 0

    // Lo estacional afecta a todo el galpón la misma semana; lo de la edad y lo
    // del lote son propios de cada uno. De ahí que las franjas ondulen juntas
    // pero no suban ni bajen a la par.
    const season =
      model.seasonal[(calendar.firstWeekOfYear + week) % SEASON_WEEKS] ?? 1

    for (const lot of lots) {
      if (lot.exitsAtWeek !== null && week >= lot.exitsAtWeek) continue

      const age = lot.ageWeeks + week
      if (age < 0) continue // todavía no llega al galpón

      // Un lote propuesto todavía no tiene historia: rinde como el promedio.
      const scale = model.lotEffects.get(lot.id)?.scale ?? 1

      const alive = Math.round(lot.hens * Math.pow(1 - WEEKLY_MORTALITY, Math.max(0, age)))
      const eggs = Math.round(alive * layingRate(age, params) * scale * season * 7)

      byLot[lot.id] = eggs
      total += eggs
      hens += alive
    }

    out.push({ week, byLot, total, hens })
  }

  return out
}

export type Purchase = {
  /** Semana en la que hay que hacer el pedido al proveedor. */
  orderAtWeek: number
  /** Semana en la que ese lote empieza a aportar de verdad. */
  layingFromWeek: number
  hens: number
  /** Qué se estaba cayendo cuando se decidió comprar. */
  deficit: number
}

export type Plan = {
  purchases: Purchase[]
  /** Proyección ya incluyendo los lotes propuestos. */
  projection: WeekProjection[]
  /** Proyección sin comprar nada: lo que pasaría si no se hace nada. */
  baseline: WeekProjection[]
  proposedLots: PlannedLot[]
  /** Semanas que siguen por debajo de la meta aun con el plan. */
  shortfallWeeks: number[]
}

export type Target = {
  /** Huevos por semana que se quieren sostener. */
  eggsPerWeek: number
  /** Ajustes puntuales: subir o bajar la meta en un tramo. */
  adjustments?: { fromWeek: number; toWeek: number; eggsPerWeek: number }[]
  /**
   * Crecer hasta una meta mayor en un plazo, en vez de exigirla desde el lunes.
   *
   * Es la diferencia entre un objetivo comercial y uno alcanzable: si se pide
   * el salto completo de una vez, el planificador ve un faltante gigante en la
   * semana 1 —que ninguna compra puede tapar, porque una pollona tarda seis
   * semanas— y responde comprando de más. Con la rampa, la meta sube al ritmo
   * al que un galpón puede crecer.
   */
  ramp?: { toEggsPerWeek: number; overWeeks: number }
}

export function targetAt(target: Target, week: number): number {
  const adjustment = target.adjustments?.find(
    (a) => week >= a.fromWeek && week <= a.toWeek,
  )
  if (adjustment) return adjustment.eggsPerWeek

  if (target.ramp && target.ramp.overWeeks > 0) {
    const progress = Math.min(1, week / target.ramp.overWeeks)
    return Math.round(
      target.eggsPerWeek +
        (target.ramp.toEggsPerWeek - target.eggsPerWeek) * progress,
    )
  }

  return target.eggsPerWeek
}

/**
 * Quedarse corto cuesta más que sobrar, pero no tanto más.
 *
 * Con el excedente casi impune el optimizador compra un lote enorme, nunca
 * falla y se pasa por el doble — que no es estabilidad. Castigarlo casi como
 * al faltante es lo que lo obliga a buscar la cadencia en vez del bulto.
 */
const SHORTFALL_WEIGHT = 1
const SURPLUS_WEIGHT = 0.65

/**
 * Tamaños de compra que se evalúan.
 *
 * El tope no es un capricho: un lote gigante hoy garantiza un valle gigante
 * dentro de veintiséis semanas, cuando entre en muda completo. Si de verdad
 * hacen falta más aves, el planificador programa dos compras separadas — que
 * además es como se reparte el riesgo en un galpón real.
 */
const SIZES = [100, 150, 200, 250]

/**
 * Qué tan lejos queda una proyección de la meta, sumando todas las semanas.
 *
 * No basta con contar semanas cortas: importa cuánto y por cuánto tiempo. Y el
 * excedente pesa, pero mucho menos — sobrar huevos es un problema menor que no
 * tenerlos.
 */
function cost(projection: WeekProjection[], target: Target): number {
  let total = 0
  for (const week of projection) {
    const goal = targetAt(target, week.week)
    const diff = week.total - goal
    total += diff < 0 ? -diff * SHORTFALL_WEIGHT : diff * SURPLUS_WEIGHT
  }
  return total
}

/**
 * Decide qué comprar y —sobre todo— CUÁNDO.
 *
 * La versión ingenua es "cuando falte producción, compre". No sirve, porque un
 * lote no aporta parejo: pasa por un pico, un valle de muda y un segundo pico.
 * Comprar en el momento equivocado apila el valle del lote nuevo sobre el valle
 * de uno viejo y deja un hueco peor que el original.
 *
 * Lo que hay que hacer es aprovechar el desfase: escoger la semana de compra
 * de modo que el pico del lote nuevo caiga sobre el valle de los que ya están.
 * Por eso el planificador no razona hacia adelante desde el primer hueco, sino
 * que evalúa cada combinación de semana y tamaño y se queda con la que más
 * aplana la curva total. Es una búsqueda voraz: agrega el mejor lote, recalcula
 * y busca el siguiente, hasta que agregar otro ya no mejore lo suficiente.
 */
export function plan(
  lots: PlannedLot[],
  model: Model,
  target: Target,
  horizonWeeks: number,
  calendar: Calendar = { firstWeekOfYear: 0 },
): Plan {
  const baseline = project(lots, model, horizonWeeks, calendar)
  const proposed: PlannedLot[] = []
  const purchases: Purchase[] = []

  // No tiene sentido comprar tan sobre el final que el lote no alcance a
  // aportar dentro del horizonte que se está mirando.
  const lastUsefulWeek = Math.max(0, horizonWeeks - WEEKS_TO_LAY - 8)

  let currentCost = cost(baseline, target)

  for (let round = 0; round < 5; round++) {
    let bestLot: PlannedLot | null = null
    let bestCost = currentCost
    let bestWeek = 0
    let bestHens = 0

    for (let week = 0; week <= lastUsefulWeek; week++) {
      for (const hens of SIZES) {
        const candidate: PlannedLot = {
          id: `nuevo-${round + 1}`,
          code: `Lote nuevo ${round + 1}`,
          ageWeeks: -week,
          hens,
          exitsAtWeek: week + PRODUCTIVE_WEEKS,
          proposed: true,
        }

        const trial = project(
          [...lots, ...proposed, candidate],
          model,
          horizonWeeks,
          calendar,
        )
        const trialCost = cost(trial, target)

        if (trialCost < bestCost) {
          bestCost = trialCost
          bestLot = candidate
          bestWeek = week
          bestHens = hens
        }
      }
    }

    // Un lote que apenas mueve la aguja no se compra: son gallinas, alimento y
    // espacio reales a cambio de una mejora que se pierde en el ruido.
    if (!bestLot || currentCost - bestCost < currentCost * 0.03) break

    const before = project([...lots, ...proposed], model, horizonWeeks, calendar)
    let deficit = 0
    for (let w = bestWeek + WEEKS_TO_LAY; w < horizonWeeks; w++) {
      deficit = Math.max(deficit, targetAt(target, w) - before[w].total)
    }

    proposed.push(bestLot)
    purchases.push({
      orderAtWeek: bestWeek,
      layingFromWeek: bestWeek + WEEKS_TO_LAY,
      hens: bestHens,
      deficit: Math.max(0, deficit),
    })
    currentCost = bestCost
  }

  // ── Refinamiento ──
  // El voraz se compromete temprano: el primer lote que escoge es el mejor
  // contra un galpón que todavía no tiene los demás. Una vez está el plan
  // completo, se vuelve sobre cada lote y se prueba correrlo de semana y
  // cambiarle el tamaño. Es donde aparece el escalonamiento fino.
  for (let pass = 0; pass < 3; pass++) {
    let moved = false

    for (let i = 0; i < proposed.length; i++) {
      const others = proposed.filter((_, j) => j !== i)
      const originalWeek = -proposed[i].ageWeeks
      let best = proposed[i]
      let bestCost = cost(
        project([...lots, ...proposed], model, horizonWeeks, calendar),
        target,
      )

      const from = Math.max(0, originalWeek - 10)
      const to = Math.min(lastUsefulWeek, originalWeek + 10)

      for (let week = from; week <= to; week++) {
        for (const hens of SIZES) {
          const candidate: PlannedLot = {
            ...proposed[i],
            ageWeeks: -week,
            hens,
            exitsAtWeek: week + PRODUCTIVE_WEEKS,
          }
          const trialCost = cost(
            project([...lots, ...others, candidate], model, horizonWeeks, calendar),
            target,
          )
          if (trialCost < bestCost - 1) {
            bestCost = trialCost
            best = candidate
            moved = true
          }
        }
      }

      proposed[i] = best
    }

    if (!moved) break
  }

  purchases.length = 0
  for (const lot of proposed) {
    const week = -lot.ageWeeks
    const without = project(
      [...lots, ...proposed.filter((l) => l.id !== lot.id)],
      model,
      horizonWeeks,
      calendar,
    )
    let deficit = 0
    for (let w = week + WEEKS_TO_LAY; w < horizonWeeks; w++) {
      deficit = Math.max(deficit, targetAt(target, w) - without[w].total)
    }
    purchases.push({
      orderAtWeek: week,
      layingFromWeek: week + WEEKS_TO_LAY,
      hens: lot.hens,
      deficit: Math.max(0, deficit),
    })
  }
  purchases.sort((a, b) => a.orderAtWeek - b.orderAtWeek)

  const projection = project([...lots, ...proposed], model, horizonWeeks, calendar)
  const shortfallWeeks = projection
    .filter((w) => w.total < targetAt(target, w.week) * 0.95)
    .map((w) => w.week)

  return { purchases, projection, baseline, proposedLots: proposed, shortfallWeeks }
}
