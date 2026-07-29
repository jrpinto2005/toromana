import { createClient } from '@/lib/supabase/server'

export type SupplierInput = {
  name: string
  nit?: string | null
  phone?: string | null
  contact?: string | null
  notes?: string | null
  active?: boolean
}

export async function createSupplier(input: SupplierInput): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name: input.name.trim(),
      nit: input.nit ?? null,
      phone: input.phone ?? null,
      contact: input.contact ?? null,
      notes: input.notes ?? null,
      active: input.active ?? true,
    })
    .select('id')
    .single()

  if (error) throw new Error(`No pude crear el proveedor: ${error.message}`)
  return data.id
}

export async function updateSupplier(
  id: string,
  input: SupplierInput,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('suppliers')
    .update({
      name: input.name.trim(),
      nit: input.nit ?? null,
      phone: input.phone ?? null,
      contact: input.contact ?? null,
      notes: input.notes ?? null,
      active: input.active ?? true,
    })
    .eq('id', id)

  if (error) throw new Error(`No pude guardar el proveedor: ${error.message}`)
}

/**
 * Registra una compra con sus líneas.
 *
 * Las líneas alimentan el inventario por trigger, no desde aquí: registrar lo
 * que llegó y sumarlo a la existencia son el mismo hecho, y separarlos es
 * abrir la puerta a que uno ocurra sin el otro.
 */
export async function createPurchase(input: {
  supplierId: string
  purchaseDate: string
  invoiceNumber?: string | null
  note?: string | null
  createdBy?: string | null
  items: { itemId: string; quantity: number; unitCostCop: number }[]
}): Promise<string> {
  const lines = input.items.filter((i) => i.quantity > 0)
  if (lines.length === 0) {
    throw new Error('La compra necesita al menos una línea con cantidad.')
  }

  const supabase = await createClient()

  const { data: purchase, error } = await supabase
    .from('purchases')
    .insert({
      supplier_id: input.supplierId,
      purchase_date: input.purchaseDate,
      invoice_number: input.invoiceNumber ?? null,
      note: input.note ?? null,
      created_by: input.createdBy ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`No pude registrar la compra: ${error.message}`)

  const { error: itemsError } = await supabase.from('purchase_items').insert(
    lines.map((i) => ({
      purchase_id: purchase.id,
      item_id: i.itemId,
      quantity: i.quantity,
      unit_cost_cop: i.unitCostCop,
    })),
  )

  if (itemsError) {
    // Sin líneas la compra no significa nada, y dejarla suma un total en cero
    // al saldo del proveedor. Se deshace.
    await supabase.from('purchases').delete().eq('id', purchase.id)
    throw new Error(`No pude guardar las líneas: ${itemsError.message}`)
  }

  return purchase.id
}

export async function deletePurchase(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('purchases').delete().eq('id', id)
  if (error) throw new Error(`No pude borrar la compra: ${error.message}`)
}

export async function registerSupplierPayment(input: {
  supplierId: string
  amountCop: number
  paidOn: string
  method: 'efectivo' | 'transferencia'
  note?: string | null
  createdBy?: string | null
}): Promise<void> {
  if (input.amountCop <= 0) {
    throw new Error('El pago tiene que ser mayor que cero.')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('supplier_payments').insert({
    supplier_id: input.supplierId,
    amount_cop: input.amountCop,
    paid_on: input.paidOn,
    method: input.method,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  })

  if (error) throw new Error(`No pude registrar el pago: ${error.message}`)
}
