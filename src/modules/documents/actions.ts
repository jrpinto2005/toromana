"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { ActionResult } from "./types";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/** Reparto marca una entrega hecha. RLS (`orders_delivery_update`) ya restringe esto al rol. */
/**
 * Marcar una entrega pasa por una función de base de datos, no por un UPDATE.
 *
 * Quien reparte ya no tiene permiso de escritura sobre `orders`: la función
 * verifica el rol y toca únicamente el estado y la marca de tiempo. Un error de
 * dedo en un celular, caminando entre entregas, no debería poder mover el total
 * de una orden ni reasignarla de cliente.
 */
export async function markDelivered(orderId: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_order_delivered", {
    order_id: orderId,
    delivered: true,
  });

  if (error) return fail(`No se pudo marcar la entrega: ${error.message}`);

  revalidatePath("/ruta");
  return { ok: true };
}

/** Deshacer una entrega marcada por error. */
export async function undoDelivered(orderId: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_order_delivered", {
    order_id: orderId,
    delivered: false,
  });

  if (error) return fail(`No se pudo deshacer la entrega: ${error.message}`);

  revalidatePath("/ruta");
  return { ok: true };
}

/**
 * Genera las órdenes de compra de un pedido confirmado: una por cada cliente
 * institucional que las requiera, con el consecutivo de su secuencia
 * (`general` o `institucional_b`) y sus copias.
 *
 * Es lo único que este módulo le expone a A — se llama una vez, al confirmar
 * el pedido semanal. `next_document_number` avanza el contador de forma
 * atómica: nunca se lee y escribe a mano, o dos confirmaciones al tiempo
 * repetirían un número.
 */
export async function generatePurchaseOrdersForRun(
  runId: string,
): Promise<{ generated: number }> {
  const supabase = await createClient();

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, customer:customers(requires_purchase_order, po_sequence, po_copies)",
    )
    .eq("run_id", runId)
    .neq("status", "omitido");

  if (error) throw new Error(`No pude leer el pedido: ${error.message}`);

  const today = new Date().toISOString().slice(0, 10);
  let generated = 0;

  for (const order of orders ?? []) {
    const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
    if (!customer?.requires_purchase_order || !customer.po_sequence) continue;

    const { data: number, error: numberError } = await supabase.rpc(
      "next_document_number",
      { seq: customer.po_sequence },
    );
    if (numberError) {
      throw new Error(`No pude generar el consecutivo: ${numberError.message}`);
    }

    const { error: insertError } = await supabase.from("purchase_orders").insert({
      order_id: order.id,
      sequence_name: customer.po_sequence,
      number,
      issue_date: today,
      copies: customer.po_copies ?? 1,
    });
    if (insertError) {
      throw new Error(`No pude guardar la orden de compra: ${insertError.message}`);
    }

    generated += 1;
  }

  return { generated };
}
