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
