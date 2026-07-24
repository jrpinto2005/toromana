"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { ActionResult } from "./types";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Reparto marca una entrega hecha. RLS (`orders_delivery_update`) ya restringe esto al rol. */
export async function markDelivered(orderId: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "entregado",
      delivered_at: new Date().toISOString(),
      delivered_by: profile.id,
    })
    .eq("id", orderId);

  if (error) return fail(`No se pudo marcar la entrega: ${error.message}`);

  revalidatePath("/ruta");
  return { ok: true };
}

/** Deshacer una entrega marcada por error. */
export async function undoDelivered(orderId: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "pendiente", delivered_at: null, delivered_by: null })
    .eq("id", orderId);

  if (error) return fail(`No se pudo deshacer la entrega: ${error.message}`);

  revalidatePath("/ruta");
  return { ok: true };
}
