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
    .select("id, lot_id, week_start, eggs, note, hen_lots(code)");
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
      note: row.note,
      layingRate: currentCount > 0 ? row.eggs / (currentCount * 7) : null,
    };
  });
}
