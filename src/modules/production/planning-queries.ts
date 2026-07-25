import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { daysBetween, today, weekStart, type IsoDate } from '@/lib/dates'
import {
  fitModel,
  PRODUCTIVE_WEEKS,
  SEASON_WEEKS,
  type Model,
  type Observation,
} from './curve'
import type { PlannedLot } from './planner'

export type LotHistory = {
  id: string
  code: string
  entryDate: IsoDate
  expectedExitDate: IsoDate | null
  initialCount: number
  currentCount: number
  active: boolean
}

export type PlanningInputs = {
  lots: PlannedLot[]
  history: LotHistory[]
  model: Model
  /** Semana del año en que arranca la proyección. */
  firstWeekOfYear: number
  /** Producción real de las últimas semanas, para contrastar con el modelo. */
  actuals: { weekStart: IsoDate; eggs: number }[]
  hensOnHand: number
}

/**
 * Reúne todo lo que necesita la planeación: la historia para ajustar la curva
 * y el estado actual del galpón para proyectar hacia adelante.
 */
export async function getPlanningInputs(): Promise<PlanningInputs> {
  const supabase = await createClient()

  const [{ data: lotRows }, { data: eventRows }, { data: productionRows }] =
    await Promise.all([
      supabase
        .from('hen_lots')
        .select('id, code, entry_date, expected_exit_date, initial_count, active'),
      supabase.from('hen_lot_events').select('lot_id, event_date, type, quantity'),
      supabase.from('egg_production').select('lot_id, week_start, eggs'),
    ])

  const lots = lotRows ?? []
  const events = eventRows ?? []
  const production = productionRows ?? []

  // Aves vivas de un lote en una fecha: el inicial menos las salidas ocurridas
  // hasta ese momento. Hace falta por semana, no solo hoy, porque una semana
  // con menos gallinas no se puede comparar contra una con el lote completo.
  const aliveAt = (lotId: string, initial: number, date: string): number => {
    let alive = initial
    for (const e of events) {
      if (e.lot_id !== lotId || e.event_date > date) continue
      alive += e.type === 'ingreso' ? e.quantity : -e.quantity
    }
    return Math.max(0, alive)
  }

  // La producción viene partida por tamaño; para la tasa de postura interesa
  // el total de la semana.
  const weekTotals = new Map<string, number>()
  for (const row of production) {
    const key = `${row.lot_id}:${row.week_start}`
    weekTotals.set(key, (weekTotals.get(key) ?? 0) + row.eggs)
  }

  const observations: Observation[] = []
  const actualsByWeek = new Map<string, number>()

  for (const [key, eggs] of weekTotals) {
    const [lotId, week] = key.split(':')
    const lot = lots.find((l) => l.id === lotId)
    if (!lot) continue

    actualsByWeek.set(week, (actualsByWeek.get(week) ?? 0) + eggs)

    const hens = aliveAt(lot.id, lot.initial_count, week)
    if (hens <= 0) continue

    observations.push({
      weeks: daysBetween(lot.entry_date, week) / 7,
      rate: eggs / (hens * 7),
      hens,
      lotId: lot.id,
      weekOfYear: weekOfYear(week),
    })
  }

  const currentWeek = weekStart(today())

  const planned: PlannedLot[] = lots
    .filter((l) => l.active)
    .map((l) => {
      const ageWeeks = Math.floor(daysBetween(l.entry_date, currentWeek) / 7)
      const exitWeeks = l.expected_exit_date
        ? Math.round(daysBetween(currentWeek, l.expected_exit_date) / 7)
        : PRODUCTIVE_WEEKS - ageWeeks

      return {
        id: l.id,
        code: l.code,
        ageWeeks,
        hens: aliveAt(l.id, l.initial_count, currentWeek),
        // Un lote cuya salida ya pasó no desaparece del galpón solo: sigue
        // ahí hasta que alguien lo saque. Se proyecta saliendo la próxima
        // semana, que es cuando debería ocurrir.
        exitsAtWeek: Math.max(1, exitWeeks),
      }
    })

  const actuals = [...actualsByWeek.entries()]
    .map(([week, eggs]) => ({ weekStart: week, eggs }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-16)

  return {
    lots: planned,
    history: lots.map((l) => ({
      id: l.id,
      code: l.code,
      entryDate: l.entry_date,
      expectedExitDate: l.expected_exit_date,
      initialCount: l.initial_count,
      currentCount: aliveAt(l.id, l.initial_count, currentWeek),
      active: l.active,
    })),
    model: fitModel(observations),
    firstWeekOfYear: weekOfYear(currentWeek),
    actuals,
    hensOnHand: planned.reduce((sum, l) => sum + l.hens, 0),
  }
}

/**
 * Meta por defecto: lo que el negocio realmente vende.
 *
 * Arrancar en la demanda comprometida y no en un número redondo es lo que
 * vuelve accionable el plan — la pregunta no es "cuántos huevos queremos"
 * sino "cuántos nos están pidiendo cada semana".
 */
export async function getWeeklyDemandEggs(): Promise<number> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('order_items')
    .select('quantity, products(name, unit), orders(delivery_runs(delivery_date, status))')
    .limit(3000)

  const perWeek = new Map<string, number>()

  for (const row of data ?? []) {
    const r = row as unknown as {
      quantity: number
      products: { name: string; unit: string } | null
      orders: { delivery_runs: { delivery_date: string; status: string } | null } | null
    }
    const run = r.orders?.delivery_runs
    if (!run || run.status === 'borrador') continue

    // Solo los productos de huevo, convertidos a unidades.
    const perTray = eggsPerUnit(r.products?.name ?? '')
    if (perTray === 0) continue

    perWeek.set(
      run.delivery_date,
      (perWeek.get(run.delivery_date) ?? 0) + r.quantity * perTray,
    )
  }

  const weeks = [...perWeek.values()]
  if (weeks.length === 0) return 0
  return Math.round(weeks.reduce((a, b) => a + b, 0) / weeks.length)
}

/** Semana del año de una fecha ISO, 0-51. */
function weekOfYear(iso: IsoDate): number {
  const [year] = iso.split('-').map(Number)
  return Math.floor(daysBetween(`${year}-01-01`, iso) / 7) % SEASON_WEEKS
}

function eggsPerUnit(productName: string): number {
  if (productName === 'Cubeta') return 30
  if (productName === 'Media cubeta') return 15
  if (productName === 'Huevo pequeño') return 30
  return 0
}
