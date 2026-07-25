/**
 * Curva de postura por edad del lote.
 *
 * Una gallina no produce parejo: no pone nada al llegar, sube rápido hasta un
 * pico, se sostiene unos meses y después cae despacio hasta que ya no paga el
 * alimento. Como el galpón tiene varios lotes de distinta edad, la producción
 * total es la suma de varias curvas desfasadas — y por eso nunca es plana.
 *
 *   huevos/gallina/día
 *   │         ╭──────────────╮
 *   │        ╱                ╲──__
 *   │       ╱                       ╲──__
 *   │______╱                              ╲
 *   └────────────────────────────────────────── semanas en galpón
 *     sin     subida     meseta       declive
 *   postura
 *
 * El modelo tiene cuatro parámetros con significado avícola, no coeficientes
 * abstractos: cuándo arranca, qué tan rápido sube, cuánto pone en el pico y
 * qué tan rápido decae. Eso importa porque el negocio tiene que poder mirar un
 * número y decir "eso no es así" — cosa imposible con una caja negra.
 */

export type CurveParams = {
  /** Semanas hasta el punto medio de la subida. */
  onsetWeeks: number
  /** Qué tan empinada es la subida. */
  ramp: number
  /** Huevos por gallina por día en el pico. */
  peakRate: number
  /** Hasta qué semana se sostiene el pico. */
  plateauWeeks: number
  /** Caída semanal después de la meseta. */
  decline: number
}

/**
 * Punto de partida cuando no hay historia suficiente.
 *
 * Son valores típicos de gallina campesina con pollonas que entran cerca del
 * punto de postura. No salen de los datos del negocio: salen de cómo se
 * comporta la especie. La app lo dice explícitamente en pantalla en vez de
 * presentarlos como si los hubiera aprendido.
 */
export const PRIOR: CurveParams = {
  onsetWeeks: 5,
  ramp: 1.7,
  peakRate: 0.72,
  plateauWeeks: 28,
  decline: 0.0042,
}

/** Semanas desde que entra una pollona hasta que produce de verdad. */
export const WEEKS_TO_LAY = 5

/** Cuánto rinde un lote antes de que deje de pagar el alimento. */
export const PRODUCTIVE_WEEKS = 52

export function layingRate(weeks: number, p: CurveParams = PRIOR): number {
  if (weeks < 0) return 0
  const ramp = 1 / (1 + Math.exp(-(weeks - p.onsetWeeks) / p.ramp))
  const decline = Math.exp(-p.decline * Math.max(0, weeks - p.plateauWeeks))
  return p.peakRate * ramp * decline
}

/**
 * Proporción de huevo pequeño a las `weeks` semanas.
 *
 * Los lotes nuevos ponen casi todo pequeño y van subiendo el calibre. Es la
 * razón por la que la producción se registra separada por tamaño.
 */
export function smallEggShare(weeks: number, p: CurveParams = PRIOR): number {
  if (weeks <= p.onsetWeeks) return 1
  return Math.max(0, Math.min(1, Math.exp(-(weeks - p.onsetWeeks) / 5)))
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
 * Lo que distingue a un lote de otro, más allá de su edad.
 *
 * Dos lotes de la misma edad no ponen igual: influyen la raza, el alimento que
 * les tocó y en qué época entraron. Un solo `peakRate` para todo el galpón
 * hacía que todas las franjas del gráfico subieran y bajaran en paralelo, que
 * es justamente lo que no pasa en la vida real.
 */
export type LotEffect = {
  /** Multiplicador sobre la curva compartida. 1 = el lote promedio. */
  scale: number
  observations: number
}

export type Model = {
  params: CurveParams
  /** Productividad relativa de cada lote. */
  lotEffects: Map<string, LotEffect>
  /**
   * Índice estacional por semana del año.
   *
   * Recoge lo que afecta a todo el galpón al tiempo —clima, calidad del
   * alimento, horas de luz— y que sí correlaciona los lotes entre sí. Es un
   * efecto de segundo orden: la edad manda, esto solo ondula.
   */
  seasonal: number[]
  observations: number
  rmse: number
  confidence: number
}

export type Fit = {
  params: CurveParams
  /** Semanas de historia que entraron al ajuste. */
  observations: number
  /** Error medio, en huevos por gallina por día. */
  rmse: number
  /**
   * Cuánto del resultado viene de los datos y cuánto del supuesto inicial,
   * entre 0 y 1. Con poca historia el ajuste se queda cerca del supuesto:
   * es preferible una respuesta prudente a una que sobreajusta seis puntos.
   */
  confidence: number
}

/** Semanas de historia a partir de las cuales el ajuste manda sobre el supuesto. */
const FULL_CONFIDENCE_AT = 60

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

/**
 * Ajusta la curva a la historia del negocio.
 *
 * Descenso por coordenadas sobre los cuatro parámetros: se prueba mover uno a
 * la vez y se conserva el movimiento si baja el error. Es deliberadamente
 * simple —cuatro parámetros y unos cientos de puntos no justifican nada más—
 * y sobre todo es predecible: la misma historia da siempre el mismo resultado.
 *
 * El resultado se mezcla con el supuesto inicial según cuánta historia haya.
 * Con dos meses de datos, ajustar libremente daría una curva que describe
 * bien esas ocho semanas y falla en todo lo demás.
 */
export function fitCurve(observations: Observation[]): Fit {
  const usable = observations.filter((o) => o.hens > 0 && o.rate >= 0)

  if (usable.length < 8) {
    return {
      params: PRIOR,
      observations: usable.length,
      rmse: rmseOf(usable, PRIOR),
      confidence: 0,
    }
  }

  const steps: Array<[keyof CurveParams, number, number, number]> = [
    // parámetro, paso inicial, mínimo, máximo
    ['onsetWeeks', 1.0, 1, 20],
    ['ramp', 0.4, 0.4, 6],
    ['peakRate', 0.05, 0.3, 1.0],
    ['plateauWeeks', 3.0, 8, 60],
    ['decline', 0.002, 0, 0.03],
  ]

  let best: CurveParams = { ...PRIOR }
  let bestError = rmseOf(usable, best)

  for (let pass = 0; pass < 40; pass++) {
    let improved = false

    for (const [key, step0, min, max] of steps) {
      const step = step0 * Math.pow(0.85, pass)

      for (const direction of [1, -1]) {
        const candidate = { ...best }
        const next = candidate[key] + direction * step
        if (next < min || next > max) continue
        candidate[key] = next

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

  // Mezcla con el supuesto: manda el ajuste solo cuando hay historia que lo sostenga.
  const blended: CurveParams = {
    onsetWeeks: mix(PRIOR.onsetWeeks, best.onsetWeeks, confidence),
    ramp: mix(PRIOR.ramp, best.ramp, confidence),
    peakRate: mix(PRIOR.peakRate, best.peakRate, confidence),
    plateauWeeks: mix(PRIOR.plateauWeeks, best.plateauWeeks, confidence),
    decline: mix(PRIOR.decline, best.decline, confidence),
  }

  return {
    params: blended,
    observations: usable.length,
    rmse: rmseOf(usable, blended),
    confidence,
  }
}

function mix(prior: number, fitted: number, weight: number): number {
  return prior * (1 - weight) + fitted * weight
}

/**
 * Cuántas semanas de un lote hacen falta para creerle su productividad propia.
 * Con menos, su factor se acerca a 1 y el lote se comporta como el promedio.
 */
const LOT_SHRINK = 12

/** Semanas de un mismo punto del año para creerle al índice estacional. */
const SEASON_SHRINK = 4

/**
 * Ajusta el modelo completo: forma compartida, productividad por lote y
 * estacionalidad.
 *
 * El orden importa y no es arbitrario. Primero la forma por edad, que es el
 * driver principal; después, sobre lo que esa forma no explica, se reparte lo
 * que es propio de cada lote y lo que le pasó a todo el galpón al mismo tiempo.
 * Estimarlos juntos dejaría que la estacionalidad se coma diferencias que en
 * realidad son de un lote, y viceversa.
 */
export function fitModel(observations: Observation[]): Model {
  const base = fitCurve(observations)
  const usable = observations.filter((o) => o.hens > 0 && o.rate >= 0)

  // ── Productividad por lote ──
  // Cociente entre lo que puso y lo que la curva esperaba a esa edad.
  const perLot = new Map<string, { actual: number; expected: number; n: number }>()

  for (const o of usable) {
    const expected = layingRate(o.weeks, base.params)
    if (expected < 0.05) continue // arranque: el cociente se dispara y no dice nada

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

  // ── Estacionalidad ──
  // Lo que queda sin explicar después de la edad y del lote, agrupado por
  // semana del año. Si un mes flojo aparece en todos los lotes a la vez, es
  // del galpón, no de las gallinas.
  const perWeek = new Map<number, { ratio: number; n: number }>()

  for (const o of usable) {
    const expected =
      layingRate(o.weeks, base.params) * (lotEffects.get(o.lotId)?.scale ?? 1)
    if (expected < 0.1) continue

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

  // Error del modelo completo, que es lo que de verdad se le presenta al negocio.
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
