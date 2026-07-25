"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(error: string): ActionResult {
  return { ok: false, error };
}

async function requireAdmin() {
  const profile = await getProfile();
  if (!profile) return fail("Sesión expirada. Vuelve a entrar.");
  if (profile.role !== "admin") return fail("Solo Administración edita ajustes.");
  return null;
}

/** Precio de lista de un producto. No toca `order_items` — los precios ya congelados no cambian. */
export async function updateProductPrice(
  productId: string,
  listPriceCop: number,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  if (!Number.isInteger(listPriceCop) || listPriceCop < 0) {
    return fail("El precio debe ser un valor en pesos, cero o mayor.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ list_price_cop: listPriceCop })
    .eq("id", productId);

  if (error) return fail(`No se pudo actualizar el precio: ${error.message}`);

  revalidatePath("/ajustes");
  return { ok: true };
}

/**
 * Ajusta el próximo número de una secuencia de recibos. Existe porque el
 * consecutivo tiene que poder calibrarse contra el histórico en papel — no
 * porque se espere tocarlo seguido.
 */
export async function updateSequenceNumber(
  sequenceName: string,
  nextNumber: number,
): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  if (!Number.isInteger(nextNumber) || nextNumber <= 0) {
    return fail("El consecutivo debe ser un entero mayor que cero.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("document_sequences")
    .update({ next_number: nextNumber })
    .eq("name", sequenceName);

  if (error) return fail(`No se pudo actualizar el consecutivo: ${error.message}`);

  revalidatePath("/ajustes");
  return { ok: true };
}

/** Datos de la empresa que aparecen en recibos y mensajes de cobro. */
export async function updateCompanySettings(input: {
  legalName: string;
  taxId: string;
  brandName: string;
  contactBlock: string;
  bankDetails: string;
  bankDetailsInstitutional: string;
}): Promise<ActionResult> {
  const guard = await requireAdmin();
  if (guard) return guard;

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_settings")
    .update({
      legal_name: input.legalName,
      tax_id: input.taxId,
      brand_name: input.brandName,
      contact_block: input.contactBlock,
      bank_details: input.bankDetails,
      bank_details_institutional: input.bankDetailsInstitutional,
    })
    .eq("id", true);

  if (error) return fail(`No se pudo actualizar la configuración: ${error.message}`);

  revalidatePath("/ajustes");
  revalidatePath("/cartera");
  return { ok: true };
}
