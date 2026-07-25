"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type {
  ActionResult,
  CreateHenLotInput,
  RecordEggProductionInput,
  RecordLotEventInput,
} from "./types";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

async function requireProduction() {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");
  if (profile.role !== "admin" && profile.role !== "produccion") {
    return fail("Solo Producción o Administración editan esto.");
  }
  return null;
}

export async function createHenLot(input: CreateHenLotInput): Promise<ActionResult> {
  const guard = await requireProduction();
  if (guard) return guard;

  if (!input.code.trim()) return fail("El código del lote es obligatorio.");
  if (!Number.isInteger(input.initialCount) || input.initialCount < 0) {
    return fail("La cantidad inicial debe ser un entero, cero o mayor.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("hen_lots").insert({
    code: input.code.trim(),
    entry_date: input.entryDate,
    initial_count: input.initialCount,
    breed: input.breed?.trim() || null,
    notes: input.notes?.trim() || null,
  });

  if (error) return fail(`No se pudo crear el lote: ${error.message}`);

  revalidatePath("/produccion");
  return { ok: true };
}

/** Da de baja un lote (se deja de mostrar en la lista activa; su historial se conserva). */
/**
 * Saca un lote de producción.
 *
 * Las gallinas salen de las cuentas, pero nada se borra: el retiro se registra
 * como un movimiento de descarte por la cantidad que quedaba, así el conteo
 * baja a cero por la misma vía que cualquier otra salida. El lote, sus
 * movimientos y todas sus semanas de producción quedan intactos, que es lo que
 * permite seguir comparando la curva de postura de un lote contra los que
 * vinieron después.
 */
export async function retireHenLot(
  lotId: string,
  note?: string | null,
): Promise<ActionResult> {
  const guard = await requireProduction();
  if (guard) return guard;

  const supabase = await createClient();
  const profile = await getProfile();

  const { data: lot } = await supabase
    .from("v_hen_lot_status")
    .select("current_count")
    .eq("id", lotId)
    .maybeSingle();

  const remaining = lot?.current_count ?? 0;

  if (remaining > 0) {
    const { error } = await supabase.from("hen_lot_events").insert({
      lot_id: lotId,
      event_date: new Date().toISOString().slice(0, 10),
      type: "descarte",
      quantity: remaining,
      note: note?.trim() || "Salida de producción del lote",
      created_by: profile?.id ?? null,
    });
    if (error) return fail(`No se pudo registrar la salida: ${error.message}`);
  }

  const { error } = await supabase
    .from("hen_lots")
    .update({ active: false })
    .eq("id", lotId);
  if (error) return fail(`No se pudo dar de baja el lote: ${error.message}`);

  revalidatePath("/produccion");
  revalidatePath("/analitica");
  return { ok: true };
}

/** Mortalidad, venta, ingreso o descarte. La cantidad actual del lote se deriva de esto. */
export async function recordLotEvent(input: RecordLotEventInput): Promise<ActionResult> {
  const guard = await requireProduction();
  if (guard) return guard;

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return fail("La cantidad debe ser un entero mayor que cero.");
  }

  const supabase = await createClient();
  const profile = await getProfile();
  const { error } = await supabase.from("hen_lot_events").insert({
    lot_id: input.lotId,
    event_date: input.eventDate,
    type: input.type,
    quantity: input.quantity,
    note: input.note?.trim() || null,
    created_by: profile?.id ?? null,
  });

  if (error) return fail(`No se pudo registrar el movimiento: ${error.message}`);

  revalidatePath("/produccion");
  revalidatePath("/analitica");
  return { ok: true };
}

/** Huevos de la semana por lote. Un `upsert` porque re-capturar la misma semana corrige, no duplica. */
export async function recordEggProduction(
  input: RecordEggProductionInput,
): Promise<ActionResult> {
  const guard = await requireProduction();
  if (guard) return guard;

  if (!Number.isInteger(input.eggs) || input.eggs < 0) {
    return fail("Los huevos deben ser un entero, cero o mayor.");
  }

  const supabase = await createClient();
  const profile = await getProfile();
  const { error } = await supabase.from("egg_production").upsert(
    {
      lot_id: input.lotId,
      week_start: input.weekStart,
      eggs: input.eggs,
      size: input.size ?? "normal",
      note: input.note?.trim() || null,
      created_by: profile?.id ?? null,
    },
    { onConflict: "lot_id,week_start,size" },
  );

  if (error) return fail(`No se pudo registrar la producción: ${error.message}`);

  revalidatePath("/produccion");
  revalidatePath("/analitica");
  return { ok: true };
}
