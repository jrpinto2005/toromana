import { createClient } from '@/lib/supabase/server'
import {
  CUSTOMER_COLUMNS,
  toCustomer,
  type Customer,
  type CustomerPause,
  type CustomerRow,
  type Recurrence,
  type Product,
  type Seller,
  type StandingItem,
} from './types'

export type CustomerFilter = {
  sellerId?: string | null
  search?: string
  recurrence?: Recurrence
  includeInactive?: boolean
}

export async function listCustomers(
  filter: CustomerFilter = {},
): Promise<Customer[]> {
  const supabase = await createClient()
  let query = supabase.from('customers').select(CUSTOMER_COLUMNS)

  if (!filter.includeInactive) query = query.eq('active', true)
  if (filter.recurrence) query = query.eq('recurrence', filter.recurrence)
  if (filter.sellerId === null) query = query.is('seller_id', null)
  else if (filter.sellerId) query = query.eq('seller_id', filter.sellerId)
  if (filter.search) query = query.ilike('name', `%${filter.search}%`)

  const { data, error } = await query.order('name')
  if (error) throw new Error(`No pude cargar los clientes: ${error.message}`)

  return (data as unknown as CustomerRow[]).map(toCustomer)
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  return data ? toCustomer(data as unknown as CustomerRow) : null
}

/** El pedido habitual del cliente: lo que se pre-llena cada semana. */
export async function getStandingItems(
  customerId: string,
): Promise<StandingItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('standing_order_items')
    .select('product_id, quantity, products(name)')
    .eq('customer_id', customerId)

  if (error) throw new Error(`No pude cargar el pedido fijo: ${error.message}`)

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      product_id: string
      quantity: number
      products: { name: string } | null
    }
    return {
      productId: r.product_id,
      productName: r.products?.name ?? '',
      quantity: Number(r.quantity),
    }
  })
}

/** Pausas que cubren una fecha: por qué un cliente no entra en el pedido. */
export async function getActivePauses(on: string): Promise<CustomerPause[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('customer_pauses')
    .select('id, customer_id, starts_on, ends_on, reason')
    .lte('starts_on', on)
    .gte('ends_on', on)

  if (error) throw new Error(`No pude cargar las pausas: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    reason: row.reason,
  }))
}

/** Todos los pedidos habituales de una vez, para la pantalla de fijos. */
export async function getAllStandingItems(): Promise<
  Map<string, Map<string, number>>
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('standing_order_items')
    .select('customer_id, product_id, quantity')

  if (error) throw new Error(`No pude cargar los pedidos fijos: ${error.message}`)

  const byCustomer = new Map<string, Map<string, number>>()
  for (const row of data ?? []) {
    const forCustomer = byCustomer.get(row.customer_id) ?? new Map()
    forCustomer.set(row.product_id, Number(row.quantity))
    byCustomer.set(row.customer_id, forCustomer)
  }
  return byCustomer
}

export async function listProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, unit, list_price_cop')
    .eq('active', true)
    .order('sort_order')

  if (error) throw new Error(`No pude cargar los productos: ${error.message}`)

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    unit: p.unit,
    listPriceCop: p.list_price_cop,
  }))
}

export async function listSellers(): Promise<Seller[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('is_seller', true)
    .order('full_name')

  if (error) throw new Error(`No pude cargar los vendedores: ${error.message}`)

  return (data ?? []).map((p) => ({ id: p.id, fullName: p.full_name }))
}
