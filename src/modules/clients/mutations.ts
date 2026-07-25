import { createClient } from '@/lib/supabase/server'
import {
  CUSTOMER_COLUMNS,
  toCustomer,
  type Customer,
  type CustomerKind,
  type CustomerRow,
  type Recurrence,
} from './types'

export type CustomerInput = {
  name: string
  address?: string | null
  phone?: string | null
  sellerId?: string | null
  kind?: CustomerKind
  recurrence?: Recurrence
  requiresPurchaseOrder?: boolean
  poCopies?: number
  poSequence?: string | null
  legalName?: string | null
  nit?: string | null
  poNote?: string | null
  notes?: string | null
  active?: boolean
}

function toRow(input: CustomerInput) {
  return {
    name: input.name.trim(),
    address: input.address ?? null,
    phone: input.phone ?? null,
    seller_id: input.sellerId ?? null,
    kind: input.kind ?? 'natural',
    recurrence: input.recurrence ?? 'ocasional',
    requires_purchase_order: input.requiresPurchaseOrder ?? false,
    po_copies: input.poCopies ?? 1,
    po_sequence: input.poSequence ?? null,
    legal_name: input.legalName ?? null,
    nit: input.nit ?? null,
    po_note: input.poNote ?? null,
    notes: input.notes ?? null,
    active: input.active ?? true,
  }
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .insert(toRow(input))
    .select(CUSTOMER_COLUMNS)
    .single()

  if (error) throw new Error(`No pude crear el cliente: ${error.message}`)
  return toCustomer(data as unknown as CustomerRow)
}

export async function updateCustomer(
  id: string,
  input: CustomerInput,
): Promise<Customer> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customers')
    .update(toRow(input))
    .eq('id', id)
    .select(CUSTOMER_COLUMNS)
    .single()

  if (error) throw new Error(`No pude guardar el cliente: ${error.message}`)
  return toCustomer(data as unknown as CustomerRow)
}

/**
 * Asigna vendedor a varios clientes de una vez.
 *
 * El Excel del que venimos no registra quién atiende a quién, así que después de
 * importar hay ~150 clientes sin dueño. Repartirlos de a uno no es viable.
 */
export async function assignSeller(
  customerIds: string[],
  sellerId: string | null,
): Promise<number> {
  if (customerIds.length === 0) return 0

  const supabase = await createClient()
  const { error, count } = await supabase
    .from('customers')
    .update({ seller_id: sellerId }, { count: 'exact' })
    .in('id', customerIds)

  if (error) throw new Error(`No pude asignar el vendedor: ${error.message}`)
  return count ?? 0
}

export async function setStandingItems(
  customerId: string,
  items: { productId: string; quantity: number }[],
): Promise<void> {
  const supabase = await createClient()

  const { error: delError } = await supabase
    .from('standing_order_items')
    .delete()
    .eq('customer_id', customerId)
  if (delError) {
    throw new Error(`No pude limpiar el pedido fijo: ${delError.message}`)
  }

  const rows = items
    .filter((i) => i.quantity > 0)
    .map((i) => ({
      customer_id: customerId,
      product_id: i.productId,
      quantity: i.quantity,
    }))

  if (rows.length === 0) return

  const { error } = await supabase.from('standing_order_items').insert(rows)
  if (error) throw new Error(`No pude guardar el pedido fijo: ${error.message}`)
}

/** Cambia una sola celda del pedido habitual. Cantidad 0 quita el producto. */
export async function setStandingItem(
  customerId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  const supabase = await createClient()

  if (quantity <= 0) {
    const { error } = await supabase
      .from('standing_order_items')
      .delete()
      .eq('customer_id', customerId)
      .eq('product_id', productId)
    if (error) throw new Error(`No pude quitar el producto: ${error.message}`)
    return
  }

  const { error } = await supabase
    .from('standing_order_items')
    .upsert(
      { customer_id: customerId, product_id: productId, quantity },
      { onConflict: 'customer_id,product_id' },
    )
  if (error) throw new Error(`No pude guardar la cantidad: ${error.message}`)
}

/**
 * Mete o saca a un cliente de la lista de fijos.
 *
 * Sacarlo no borra su pedido habitual: si vuelve a entrar, vuelve con lo mismo
 * que pedía antes. Un cliente que se va y regresa es normal en este negocio.
 */
export async function setRecurrence(
  customerId: string,
  recurrence: Recurrence,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('customers')
    .update({ recurrence })
    .eq('id', customerId)
  if (error) throw new Error(`No pude cambiar la frecuencia: ${error.message}`)
}

export async function createPause(input: {
  customerId: string
  startsOn: string
  endsOn: string
  reason?: string | null
}): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('customer_pauses').insert({
    customer_id: input.customerId,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    reason: input.reason ?? null,
  })

  if (error) throw new Error(`No pude registrar la pausa: ${error.message}`)
}

export async function deletePause(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('customer_pauses').delete().eq('id', id)
  if (error) throw new Error(`No pude quitar la pausa: ${error.message}`)
}
