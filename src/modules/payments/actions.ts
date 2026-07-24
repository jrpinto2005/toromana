"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { today } from "@/lib/dates";
import type { ActionResult, RegisterPaymentInput } from "./types";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/**
 * Registra un pago.
 *
 * Quién puede hacer qué no se decide aquí — lo decide RLS. Pero el rol sí cambia
 * la forma del registro: reparto **reporta** efectivo (`por_confirmar`) y
 * contabilidad lo **confirma**. Es la regla que impide que el repartidor escriba
 * directo en la contabilidad.
 */
export async function registerPayment(input: RegisterPaymentInput): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");

  if (!Number.isInteger(input.amountCop) || input.amountCop <= 0) {
    return fail("El monto debe ser un valor en pesos mayor que cero.");
  }

  const isReparto = profile.role === "reparto";

  if (isReparto && input.method !== "efectivo") {
    return fail("Reparto solo puede reportar pagos en efectivo.");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("payments").insert({
    customer_id: input.customerId,
    amount_cop: input.amountCop,
    method: input.method,
    paid_at: input.paidAt,
    // El comprobante solo existe en transferencias: la base tiene un check que
    // rechaza la fila si viene con efectivo, así que se limpia antes de insertar.
    receipt_holder:
      input.method === "transferencia" ? (input.receiptHolderId ?? null) : null,
    status: isReparto ? "por_confirmar" : "confirmado",
    received_by: profile.id,
    reported_by: isReparto ? profile.id : null,
    confirmed_by: isReparto ? null : profile.id,
    confirmed_at: isReparto ? null : new Date().toISOString(),
    note: input.note?.trim() || null,
  });

  if (error) return fail(`No se pudo registrar el pago: ${error.message}`);

  revalidatePath("/cartera");
  revalidatePath(`/cartera/${input.customerId}`);
  revalidatePath("/ruta");
  return { ok: true };
}

/**
 * Reporte de efectivo desde la ruta. Siempre entra `por_confirmar`: el
 * repartidor dice cuánto recibió, contabilidad valida contra lo que llegó a caja.
 */
export async function reportCashFromRoute(args: {
  customerId: string;
  amountCop: number;
  orderId?: string | null;
  note?: string | null;
}): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");

  if (!Number.isInteger(args.amountCop) || args.amountCop <= 0) {
    return fail("El monto debe ser un valor en pesos mayor que cero.");
  }

  const supabase = await createClient();

  const { error } = await supabase.from("payments").insert({
    customer_id: args.customerId,
    amount_cop: args.amountCop,
    method: "efectivo",
    paid_at: today(),
    status: "por_confirmar",
    reported_by: profile.id,
    received_by: profile.id,
    order_id: args.orderId ?? null,
    note: args.note?.trim() || null,
  });

  if (error) return fail(`No se pudo reportar el efectivo: ${error.message}`);

  revalidatePath("/ruta");
  revalidatePath("/cartera");
  return { ok: true };
}

/** Contabilidad valida un efectivo reportado. Aquí sí baja el saldo del cliente. */
export async function confirmPayment(paymentId: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");

  if (profile.role !== "admin" && profile.role !== "contabilidad") {
    return fail("Solo Administración o Contabilidad confirman pagos.");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("payments")
    .update({
      status: "confirmado",
      confirmed_by: profile.id,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", paymentId)
    .eq("status", "por_confirmar");

  if (error) return fail(`No se pudo confirmar el pago: ${error.message}`);

  revalidatePath("/cartera");
  return { ok: true };
}

/**
 * Borra un pago mal registrado. No hay "editar": un pago es un hecho, y
 * corregirlo en sitio deja el rastro de auditoría sin explicación. Se elimina y
 * se vuelve a registrar bien.
 */
export async function deletePayment(paymentId: string): Promise<ActionResult> {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");

  if (profile.role !== "admin" && profile.role !== "contabilidad") {
    return fail("Solo Administración o Contabilidad eliminan pagos.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("payments").delete().eq("id", paymentId);
  if (error) return fail(`No se pudo eliminar el pago: ${error.message}`);

  revalidatePath("/cartera");
  return { ok: true };
}

/** Vendedores y contabilidad: para los selectores de "quién recibió" y "quién tiene el comprobante". */
export async function listPaymentHandlers(): Promise<
  { id: string; fullName: string; role: string }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name");

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
  }));
}
