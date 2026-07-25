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
}

export function targetAt(target: Target, week: number): number {
  const adjustment = target.adjustments?.find(
    (a) => week >= a.fromWeek && week <= a.toWeek,
  )
  return adjustment ? adjustment.eggsPerWeek : target.eggsPerWeek
}

/**
 * Decide qué comprar y cuándo para sostener la meta.
 *
 * El problema no es detectar que falta producción: eso se ve solo. El problema
 * es que para cuando se nota, ya es tarde — una pollona comprada hoy no aporta
 * hasta dentro de cinco semanas. Por eso el planificador recorre el futuro
 * buscando la PRIMERA semana que cae por debajo de la meta y retrocede el
 * tiempo de arranque para decir cuándo hay que hacer el pedido.
 *
 * Es un algoritmo voraz: resuelve el primer hueco, recalcula con ese lote
 * dentro, y busca el siguiente. Para un horizonte de un año y lotes que se
 * compran de a uno, encuentra lo mismo que una búsqueda exhaustiva y se
 * entiende leyéndolo, que en un negocio de cuatro personas vale más.
 */
export function plan(
  lots: PlannedLot[],
  model: Model,
  target: Target,
  horizonWeeks: number,
  calendar: Calendar = { firstWeekOfYear: 0 },
): Plan {
  const params = model.params
  const baseline = project(lots, model, horizonWeeks, calendar)
  const proposed: PlannedLot[] = []
  const purchases: Purchase[] = []

  // Ventana que se mira para dimensionar un lote: medio año. Un lote se compra
  // para cubrir un bache completo, no la primera semana del bache.
  const WINDOW = 26

  // Postura de un lote ya establecido. Dimensionar con la postura que tendría
  // la semana del hueco daría cifras absurdas: si el hueco llega antes de que
  // alcance a arrancar, esa tasa es casi cero y el cálculo pediría miles de
  // gallinas para tapar un faltante de unos cientos.
  const matureRate = layingRate(WEEKS_TO_LAY + 6, params)

  let searchFrom = 0

  for (let round = 0; round < 8; round++) {
    const current = project([...lots, ...proposed], model, horizonWeeks, calendar)

    const gapWeek = current.findIndex(
      (w) => w.week >= searchFrom && w.total < targetAt(target, w.week),
    )
    if (gapWeek === -1) break

    // El lote se dimensiona por el punto más bajo del bache, no por su borde.
    const windowEnd = Math.min(horizonWeeks - 1, gapWeek + WINDOW)
    let deficit = 0
    for (let w = gapWeek; w <= windowEnd; w++) {
      deficit = Math.max(deficit, targetAt(target, w) - current[w].total)
    }

    // Si el hueco llega antes de que una pollona pueda estar produciendo, no
    // hay nada que comprar que lo evite: se pide lo antes posible y esas
    // semanas quedan reportadas como faltante inevitable.
    const orderAtWeek = Math.max(0, gapWeek - WEEKS_TO_LAY)
    const hens = Math.max(
      MIN_LOT,
      Math.ceil(deficit / (matureRate * 7) / LOT_STEP) * LOT_STEP,
    )

    searchFrom = orderAtWeek + WEEKS_TO_LAY

    proposed.push({
      id: `nuevo-${round + 1}`,
      code: `Lote nuevo ${round + 1}`,
      ageWeeks: -orderAtWeek,
      hens,
      exitsAtWeek: orderAtWeek + PRODUCTIVE_WEEKS,
      proposed: true,
    })

    purchases.push({
      orderAtWeek,
      layingFromWeek: orderAtWeek + WEEKS_TO_LAY,
      hens,
      deficit,
    })
  }

  const projection = project([...lots, ...proposed], model, horizonWeeks, calendar)
  const shortfallWeeks = projection
    .filter((w) => w.total < targetAt(target, w.week) * 0.98)
    .map((w) => w.week)

  return { purchases, projection, baseline, proposedLots: proposed, shortfallWeeks }
}
