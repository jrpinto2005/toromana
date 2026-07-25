import { createClient } from "@/lib/supabase/server";
import type { EggProductionEntry, HenLot, HenLotEvent } from "./types";

/** Lotes con su cantidad actual, derivada por `v_hen_lot_status` — nunca se teclea suelta. */
export async function listHenLots(opts?: { includeInactive?: boolean }): Promise<HenLot[]> {
  const supabase = await createClient();

  let query = supabase
    .from("v_hen_lot_status")
    .select("id, code, entry_date, initial_count, breed, active, current_count");
  if (!opts?.includeInactive) query = query.eq("active", true);

  const { data, error } = await query.order("entry_date", { ascending: false });
  if (error) throw new Error(`No pude cargar los lotes: ${error.message}`);

  // `notes` no vive en la vista derivada; se completa con la tabla base.
  const { data: notesRows } = await supabase.from("hen_lots").select("id, notes");
  const notesById = new Map((notesRows ?? []).map((r) => [r.id, r.notes]));

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    entryDate: row.entry_date,
    initialCount: row.initial_count,
    currentCount: row.current_count,
    breed: row.breed,
    notes: notesById.get(row.id) ?? null,
    active: row.active,
  }));
}

export async function getHenLot(lotId: string): Promise<HenLot | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_hen_lot_status")
    .select("id, code, entry_date, initial_count, breed, active, current_count")
    .eq("id", lotId)
    .maybeSingle();
  if (!data) return null;

  const { data: base } = await supabase
    .from("hen_lots")
    .select("notes")
    .eq("id", lotId)
    .maybeSingle();

  return {
    id: data.id,
    code: data.code,
    entryDate: data.entry_date,
    initialCount: data.initial_count,
    currentCount: data.current_count,
    breed: data.breed,
    notes: base?.notes ?? null,
    active: data.active,
  };
}

export async function listLotEvents(lotId: string): Promise<HenLotEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hen_lot_events")
    .select("id, lot_id, event_date, type, quantity, note")
    .eq("lot_id", lotId)
    .order("event_date", { ascending: false });

  if (error) throw new Error(`No pude cargar los movimientos: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    lotId: row.lot_id,
    eventDate: row.event_date,
    type: row.type,
    quantity: row.quantity,
    note: row.note,
  }));
}

/**
 * Producción semanal con la tasa de postura ya calculada: `eggs / (current_count × 7)`.
 * Sin `weekStart` trae todo; con él, solo la semana pedida (para el formulario
 * de captura, que pre-llena lo ya guardado).
 */
export async function listEggProduction(opts?: {
  weekStart?: string;
  lotId?: string;
}): Promise<EggProductionEntry[]> {
  const supabase = await createClient();

  let query = supabase
    .from("egg_production")
    .select("id, lot_id, week_start, eggs, size, note, hen_lots(code)");
  if (opts?.weekStart) query = query.eq("week_start", opts.weekStart);
  if (opts?.lotId) query = query.eq("lot_id", opts.lotId);

  const { data, error } = await query.order("week_start", { ascending: false });
  if (error) throw new Error(`No pude cargar la producción: ${error.message}`);

  const lots = await listHenLots({ includeInactive: true });
  const countById = new Map(lots.map((lot) => [lot.id, lot.currentCount]));

  return (data ?? []).map((row) => {
    const lot = Array.isArray(row.hen_lots) ? row.hen_lots[0] : row.hen_lots;
    const currentCount = countById.get(row.lot_id) ?? 0;
    return {
      id: row.id,
      lotId: row.lot_id,
      lotCode: lot?.code ?? "—",
      weekStart: row.week_start,
      eggs: row.eggs,
      size: row.size,
      note: row.note,
      layingRate: currentCount > 0 ? row.eggs / (currentCount * 7) : null,
    };
  });
}

export type WeeklyLayingRate = {
  weekStart: string;
  /** Huevos de la semana, sumando ambos tamaños. */
  eggs: number;
  smallEggs: number;
  /** Gallinas que había ESA semana, no las de hoy. */
  hens: number;
  /** Huevos por gallina por día. */
  rate: number;
};

/**
 * Tasa de postura del galpón, semana a semana.
 *
 * Existe porque calcularla fila por fila daba dos cosas mal a la vez. La
 * producción se registra separada por tamaño de huevo, así que cada semana
 * tiene dos filas y cada una mostraba la mitad de la tasa real. Y se dividía
 * por las gallinas de hoy, no por las de esa semana: un lote que ya se vendió
 * dejaba sus semanas divididas por cero, y las semanas viejas de un lote
 * grande quedaban divididas por lo que sobrevive hoy.
 */
export async function listWeeklyLayingRate(): Promise<WeeklyLayingRate[]> {
  const supabase = await createClient();

  const [{ data: lotRows }, { data: eventRows }, { data: productionRows }] =
    await Promise.all([
      supabase.from("hen_lots").select("id, initial_count"),
      supabase.from("hen_lot_events").select("lot_id, event_date, type, quantity"),
      supabase.from("egg_production").select("lot_id, week_start, eggs, size"),
    ]);

  const lots = lotRows ?? [];
  const events = eventRows ?? [];

  const aliveAt = (lotId: string, initial: number, date: string): number => {
    let alive = initial;
    for (const e of events) {
      if (e.lot_id !== lotId || e.event_date > date) continue;
      alive += e.type === "ingreso" ? e.quantity : -e.quantity;
    }
    return Math.max(0, alive);
  };

  const byWeek = new Map<string, { eggs: number; small: number; hens: number }>();
  const counted = new Set<string>();

  for (const row of productionRows ?? []) {
    const lot = lots.find((l) => l.id === row.lot_id);
    if (!lot) continue;

    const acc = byWeek.get(row.week_start) ?? { eggs: 0, small: 0, hens: 0 };
    acc.eggs += row.eggs;
    if (row.size === "pequeno") acc.small += row.eggs;

    // Las gallinas de un lote se cuentan una sola vez por semana, aunque esa
    // semana traiga una fila de huevo normal y otra de pequeño.
    const key = `${row.week_start}:${row.lot_id}`;
    if (!counted.has(key)) {
      counted.add(key);
      acc.hens += aliveAt(lot.id, lot.initial_count, row.week_start);
    }

    byWeek.set(row.week_start, acc);
  }

  return [...byWeek.entries()]
    .map(([weekStart, acc]) => ({
      weekStart,
      eggs: acc.eggs,
      smallEggs: acc.small,
      hens: acc.hens,
      rate: acc.hens > 0 ? acc.eggs / (acc.hens * 7) : 0,
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}
