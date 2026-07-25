/**
 * Curva de postura por edad del lote.
 *
 * Un lote NO sube a un pico y baja para siempre: pasa por dos ciclos. Arranca
 * en cero, sube a su primer pico, entra en muda —para de poner, renueva plumaje
 * y cae a la mitad— y vuelve a un segundo pico casi tan bueno como el primero.
 * Solo después decae de verdad, y se vende antes de que llegue a cero.
 *
 *  % del máximo del lote
 *  100 │        ╭─────╮                 ╭────╮
 *      │      ╭─╯      ╲               ╱      ╲___
 *   75 │     ╱           ╲            ╱            ╲___
 *      │    ╱              ╲         ╱                  ╲___
 *   50 │   ╱                ╲──────╱                         ●  se vende
 *      │  ╱
 *    0 │──────
 *      └───┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬───
 *      0   6   12   16   22   26   30   35   40   43   50   56  semanas
 *
 * Que haya dos picos y un valle es lo que abre la oportunidad del negocio:
 * comprando los lotes desfasados, el pico de uno cae sobre el valle de otro y
 * la suma se aplana sin comprar una gallina de más. Con una curva de un solo
 * pico ese problema ni siquiera existe — por eso el modelo anterior no servía.
 */

export type CurveParams = {
  /** Huevos por gallina por día en el punto más alto de su vida. */
  peakRate: number
  /** Semana en la que va por la mitad de la subida inicial. */
  riseMid: number
  /** Qué tan empinada es la subida. */
  riseSteep: number
  /** Cuánto cae en la muda, como fracción del máximo. */
  moltDepth: number
  /** Semana en la que empieza a caer hacia la muda. */
  moltStart: number
  /** Semana en la que termina de recuperarse de la muda. */
  moltEnd: number
  /** Qué tan suaves son la entrada y la salida de la muda. */
  moltRamp: number
  /** Semana desde la que empieza el declive final. */
  declineStart: number
  /** Caída semanal del declive final. */
  declineRate: number
}

/**
 * Forma típica de la especie, para cuando no hay historia suficiente.
 *
 * Reproduce el comportamiento que el negocio observa: nada hasta la sexta
 * semana, ~80% en la doce, tope en la dieciséis, valle a la mitad entre la
 * treinta y la treinta y tres, segundo tope hacia la cuarenta y declive hasta
 * la mitad en la cincuenta y seis.
 */
export const PRIOR: CurveParams = {
  peakRate: 0.85,
  riseMid: 9.8,
  riseSteep: 1.7,
  moltDepth: 0.65,
  moltStart: 26,
  moltEnd: 35,
  moltRamp: 2.2,
  declineStart: 43,
  declineRate: 0.0533,
}

/** Semanas desde que entra una pollona hasta que produce de verdad. */
export const WEEKS_TO_LAY = 6

/** Cuánto se conserva un lote antes de venderlo. */
export const PRODUCTIVE_WEEKS = 58

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

/**
 * Producción relativa a la edad `weeks`, entre 0 y 1.
 *
 * Es el producto de tres cosas que ocurren en momentos distintos: la entrada en
 * postura, la muda y el declive final. Separarlas así permite que cada una se
 * ajuste con sus propios datos en vez de forzar una sola forma rígida.
 */
export function relativeRate(weeks: number, p: CurveParams = PRIOR): number {
  if (weeks < 0) return 0

  const rise = sigmoid((weeks - p.riseMid) / p.riseSteep)

  // Valle de fondo plano: dos sigmoides opuestas abren y cierran la muda.
  const molt =
    1 -
    p.moltDepth *
      sigmoid((weeks - p.moltStart) / p.moltRamp) *
      sigmoid((p.moltEnd - weeks) / p.moltRamp)

  const decline = Math.exp(-p.declineRate * Math.max(0, weeks - p.declineStart))

  return Math.max(0, rise * molt * decline)
}

/** Huevos por gallina por día a las `weeks` semanas en galpón. */
export function layingRate(weeks: number, p: CurveParams = PRIOR): number {
  return p.peakRate * relativeRate(weeks, p)
}

/**
 * Proporción de huevo pequeño.
 *
 * Alta al arranque y otra vez —menos— al volver de la muda: la gallina que
 * reinicia postura tarda unas semanas en recuperar calibre.
 */
export function smallEggShare(weeks: number, p: CurveParams = PRIOR): number {
  const early = Math.exp(-Math.max(0, weeks - p.riseMid + 4) / 5)
  const afterMolt = 0.35 * Math.exp(-Math.pow((weeks - p.moltEnd) / 3.5, 2))
  return Math.max(0, Math.min(1, early + afterMolt))
}

export type Observation = {
  /** Semanas que llevaba el lote en galpón. */
  weeks: number
  /** Huevos por gallina por día observados esa semana. */
  rate: number
  /** Gallinas del lote: una semana con más aves pesa más en el ajuste. */
  hens: number
  lotId: string
  /** Semana del año, para separar lo estacional de lo que impone la edad. */
  weekOfYear: number
}

export const SEASON_WEEKS = 52

/**
 * Lo que distingue a un lote de otro más allá de su edad: raza, alimento, la
 * época en que entró. Sin esto todas las curvas del galpón se moverían igual.
 */
export type LotEffect = {
  /** Multiplicador sobre la curva compartida. 1 = el lote promedio. */
  scale: number
  observations: number
}

export type Model = {
  params: CurveParams
  lotEffects: Map<string, LotEffect>
  /**
   * Índice estacional por semana del año: lo que afecta a todo el galpón al
   * tiempo. Es de segundo orden — la edad manda, esto solo ondula.
   */
  seasonal: number[]
  observations: number
  rmse: number
  confidence: number
}

/** Semanas de historia a partir de las cuales el ajuste manda sobre el supuesto. */
const FULL_CONFIDENCE_AT = 80

/** Semanas de un lote para creerle su productividad propia. */
const LOT_SHRINK = 12

/** Observaciones de una misma semana del año para creerle a la estacionalidad. */
const SEASON_SHRINK = 4

function rmseOf(obs: Observation[], p: CurveParams): number {
  if (obs.length === 0) return 0
  let weighted = 0
  let total = 0
  for (const o of obs) {
    const error = o.rate - layingRate(o.weeks, p)
    weighted += o.hens * error * error
    total += o.hens
  }
  return Math.sqrt(weighted / Math.max(1, total))
}

type Step = [keyof CurveParams, number, number, number]

// Qué tanto se deja mover cada parámetro. La muda no se busca en todo el
// rango: si el ajuste puede correrla treinta semanas, con poca historia la
// planta donde haya un bache de ruido y la curva pierde sentido biológico.
const STEPS: Step[] = [
  ['peakRate', 0.04, 0.35, 1.2],
  ['riseMid', 0.8, 6, 16],
  ['riseSteep', 0.3, 0.8, 4],
  ['moltDepth', 0.05, 0.2, 0.85],
  ['moltStart', 1.5, 18, 34],
  ['moltEnd', 1.5, 28, 44],
  ['declineStart', 2.0, 36, 56],
  ['declineRate', 0.008, 0.005, 0.12],
]

/**
 * Ajusta la forma de la curva a la historia del negocio.
 *
 * Descenso por coordenadas: se mueve un parámetro a la vez y se conserva el
 * movimiento si baja el error. Es deliberadamente simple y, sobre todo,
 * predecible — la misma historia da siempre el mismo resultado.
 *
 * El resultado se mezcla con la forma típica de la especie según cuánta
 * historia haya. Un lote y medio de datos no alcanza a definir dónde queda la
 * muda; ajustar libremente daría una curva que describe ese lote y falla en el
 * siguiente.
 */
export function fitCurve(observations: Observation[]): {
  params: CurveParams
  rmse: number
  confidence: number
} {
  const usable = observations.filter((o) => o.hens > 0 && o.rate >= 0)

  if (usable.length < 12) {
    return { params: PRIOR, rmse: rmseOf(usable, PRIOR), confidence: 0 }
  }

  let best: CurveParams = { ...PRIOR }
  let bestError = rmseOf(usable, best)

  for (let pass = 0; pass < 45; pass++) {
    let improved = false

    for (const [key, step0, min, max] of STEPS) {
      const step = step0 * Math.pow(0.88, pass)

      for (const direction of [1, -1]) {
        const candidate = { ...best, [key]: best[key] + direction * step }
        if (candidate[key] < min || candidate[key] > max) continue
        // La muda tiene que seguir siendo una muda: sin esto el ajuste puede
        // cruzar inicio y fin y producir una curva sin valle.
        if (candidate.moltEnd - candidate.moltStart < 4) continue

        const error = rmseOf(usable, candidate)
        if (error < bestError - 1e-9) {
          best = candidate
          bestError = error
          improved = true
        }
      }
    }

    if (!improved) break
  }

  const confidence = Math.max(0, Math.min(1, usable.length / FULL_CONFIDENCE_AT))

  const blended = Object.fromEntries(
    (Object.keys(PRIOR) as (keyof CurveParams)[]).map((key) => [
      key,
      mix(PRIOR[key], best[key], confidence),
    ]),
  ) as CurveParams

  return { params: blended, rmse: rmseOf(usable, blended), confidence }
}

/**
 * Ajusta el modelo completo: forma por edad, productividad por lote y
 * estacionalidad.
 *
 * El orden no es arbitrario. Primero la forma, que es el driver principal;
 * después, sobre lo que esa forma no explica, se reparte lo que es propio de
 * cada lote y lo que le pasó a todo el galpón al mismo tiempo. Estimarlos
 * juntos dejaría que la estacionalidad se coma diferencias que son de un lote.
 */
export function fitModel(observations: Observation[]): Model {
  const base = fitCurve(observations)
  const usable = observations.filter((o) => o.hens > 0 && o.rate >= 0)

  const perLot = new Map<string, { actual: number; expected: number; n: number }>()
  for (const o of usable) {
    const expected = layingRate(o.weeks, base.params)
    if (expected < 0.08) continue // arranque y fondo de muda: el cociente se dispara

    const acc = perLot.get(o.lotId) ?? { actual: 0, expected: 0, n: 0 }
    acc.actual += o.rate * o.hens
    acc.expected += expected * o.hens
    acc.n += 1
    perLot.set(o.lotId, acc)
  }

  const lotEffects = new Map<string, LotEffect>()
  for (const [lotId, acc] of perLot) {
    const raw = acc.expected > 0 ? acc.actual / acc.expected : 1
    const weight = acc.n / (acc.n + LOT_SHRINK)
    lotEffects.set(lotId, {
      scale: clamp(mix(1, raw, weight), 0.6, 1.4),
      observations: acc.n,
    })
  }

  const perWeek = new Map<number, { ratio: number; n: number }>()
  for (const o of usable) {
    const expected =
      layingRate(o.weeks, base.params) * (lotEffects.get(o.lotId)?.scale ?? 1)
    if (expected < 0.15) continue

    const acc = perWeek.get(o.weekOfYear) ?? { ratio: 0, n: 0 }
    acc.ratio += o.rate / expected
    acc.n += 1
    perWeek.set(o.weekOfYear, acc)
  }

  const seasonal = Array.from({ length: SEASON_WEEKS }, (_, week) => {
    const acc = perWeek.get(week)
    if (!acc || acc.n === 0) return 1
    const weight = acc.n / (acc.n + SEASON_SHRINK)
    return clamp(mix(1, acc.ratio / acc.n, weight), 0.85, 1.15)
  })

  let weighted = 0
  let totalHens = 0
  for (const o of usable) {
    const predicted =
      layingRate(o.weeks, base.params) *
      (lotEffects.get(o.lotId)?.scale ?? 1) *
      seasonal[o.weekOfYear % SEASON_WEEKS]
    const error = o.rate - predicted
    weighted += o.hens * error * error
    totalHens += o.hens
  }

  return {
    params: base.params,
    lotEffects,
    seasonal,
    observations: usable.length,
    rmse: Math.sqrt(weighted / Math.max(1, totalHens)),
    confidence: base.confidence,
  }
}

function mix(prior: number, fitted: number, weight: number): number {
  return prior * (1 - weight) + fitted * weight
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
