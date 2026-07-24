import { createClient } from '@/lib/supabase/server'
import type {
  DeliveryRun,
  Order,
  OrderItem,
  PausedCustomer,
  RunDetail,
  RunSummary,
} from './types'

type RunRow = {
  id: string
  delivery_date: string
  status: DeliveryRun['status']
  notes: string | null
  confirmed_at: string | null
}

function toRun(row: RunRow): DeliveryRun {
  return {
    id: row.id,
    deliveryDate: row.delivery_date,
    status: row.status,
    notes: row.notes,
    confirmedAt: row.confirmed_at,
  }
}

export async function listRuns(): Promise<RunSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('delivery_runs')
    .select('id, delivery_date, status, notes, confirmed_at, orders(total_cop)')
    .order('delivery_date', { ascending: false })

  if (error) throw new Error(`No pude cargar los pedidos: ${error.message}`)

  return (data ?? []).map((row) => {
    const r = row as unknown as RunRow & { orders: { total_cop: number }[] }
    return {
      ...toRun(r),
      orderCount: r.orders.length,
      totalCop: r.orders.reduce((sum, o) => sum + (o.total_cop ?? 0), 0),
    }
  })
}

export async function getRun(id: string): Promise<DeliveryRun | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('delivery_runs')
    .select('id, delivery_date, status, notes, confirmed_at')
    .eq('id', id)
    .maybeSingle()

  return data ? toRun(data as unknown as RunRow) : null
}

export async function getRunDetail(runId: string): Promise<RunDetail | null> {
  const run = await getRun(runId)
  if (!run) return null

  const supabase = await createClient()

  const [{ data: orderRows, error }, { data: productRows }] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, run_id, customer_id, seller_id, status, source, note, total_cop, ' +
          'customers(name, address), ' +
          'order_items(id, product_id, quantity, unit_price_cop, subtotal_cop, products(name, unit))',
      )
      .eq('run_id', runId),
    supabase.from('products').select('id, list_price_cop'),
  ])

  if (error) throw new Error(`No pude cargar el pedido: ${error.message}`)

  const listPrice = new Map(
    (productRows ?? []).map((p) => [p.id as string, p.list_price_cop as number]),
  )

  const orders: Order[] = (orderRows ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      run_id: string
      customer_id: string
      seller_id: string | null
      status: Order['status']
      source: Order['source']
      note: string | null
      total_cop: number
      customers: { name: string; address: string | null } | null
      order_items: {
        id: string
        product_id: string
        quantity: number
        unit_price_cop: number
        subtotal_cop: number
        products: { name: string; unit: string } | null
      }[]
    }

    const items: OrderItem[] = r.order_items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.products?.name ?? '',
      unit: i.products?.unit ?? '',
      quantity: Number(i.quantity),
      unitPriceCop: i.unit_price_cop,
      subtotalCop: i.subtotal_cop,
      listPriceCop: listPrice.get(i.product_id) ?? i.unit_price_cop,
    }))

    return {
      id: r.id,
      runId: r.run_id,
      customerId: r.customer_id,
      customerName: r.customers?.name ?? '',
      customerAddress: r.customers?.address ?? null,
      sellerId: r.seller_id,
      status: r.status,
      source: r.source,
      note: r.note,
      // El total guardado se congela al confirmar. Mientras el pedido está en
      // borrador se muestra la suma en vivo de las líneas.
      totalCop:
        run.status === 'borrador'
          ? items.reduce((sum, i) => sum + i.subtotalCop, 0)
          : r.total_cop,
      items,
    }
  })

  orders.sort((a, b) => a.customerName.localeCompare(b.customerName, 'es'))

  return { run, orders, paused: await getPausedFor(run.deliveryDate) }
}

/** Fijos que quedaron fuera esta semana, con el motivo a la vista. */
export async function getPausedFor(date: string): Promise<PausedCustomer[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('customer_pauses')
    .select('reason, ends_on, customers(id, name, recurrence, active)')
    .lte('starts_on', date)
    .gte('ends_on', date)

  return (data ?? [])
    .map((row) => {
      const r = row as unknown as {
        reason: string | null
        ends_on: string
        customers: {
          id: string
          name: string
          recurrence: string
          active: boolean
        } | null
      }
      return r.customers && r.customers.active && r.customers.recurrence !== 'ocasional'
        ? {
            customerId: r.customers.id,
            customerName: r.customers.name,
            reason: r.reason,
            endsOn: r.ends_on,
          }
        : null
    })
    .filter((p): p is PausedCustomer => p !== null)
}

/**
 * Último precio cobrado a cada cliente por producto.
 *
 * Es lo que permite que un cliente con precio pactado —un institucional con
 * descuento, por ejemplo— vuelva a salir a su precio sin mantener una tabla de
 * tarifas: el historial es la fuente de verdad.
 */
export async function getLastPrices(): Promise<Map<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('order_items')
    .select('product_id, unit_price_cop, orders(customer_id, delivery_runs(delivery_date))')
    .order('created_at', { referencedTable: 'orders', ascending: false })
    .limit(4000)

  const prices = new Map<string, { price: number; date: string }>()

  for (const row of data ?? []) {
    const r = row as unknown as {
      product_id: string
      unit_price_cop: number
      orders: {
        customer_id: string
        delivery_runs: { delivery_date: string } | null
      } | null
    }
    if (!r.orders) continue

    const key = `${r.orders.customer_id}:${r.product_id}`
    const date = r.orders.delivery_runs?.delivery_date ?? ''
    const current = prices.get(key)
    if (!current || date > current.date) {
      prices.set(key, { price: r.unit_price_cop, date })
    }
  }

  return new Map([...prices].map(([key, v]) => [key, v.price]))
}
