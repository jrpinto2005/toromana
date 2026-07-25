import { createClient } from '@/lib/supabase/server'
import { getLastPrices } from './queries'
import type { DeliveryRun } from './types'

/**
 * Decide si a un cliente quincenal le toca esta semana.
 *
 * Sin ancla no hay forma de saberlo, así que se incluye: es preferible que
 * alguien sobre y lo quiten, a que falte y nadie lo note.
 */
function biweeklyMatches(anchor: string | null, deliveryDate: string): boolean {
  if (!anchor) return true
  const days = Math.round(
    (Date.parse(deliveryDate) - Date.parse(anchor)) / 86_400_000,
  )
  return Math.floor(days / 7) % 2 === 0
}

export type GenerationResult = {
  run: DeliveryRun
  generated: number
  skippedByPause: number
  /** El pedido de esa fecha ya existía: se abrió, no se creó otro. */
  alreadyExisted?: boolean
}

/**
 * Crea el pedido de la semana y lo llena solo.
 *
 * Reemplaza el "clonar la hoja de fijos" del Excel: entra todo cliente semanal,
 * más los quincenales a los que les toca, cada uno con su pedido habitual y al
 * último precio que se le cobró.
 */
export async function createRun(
  deliveryDate: string,
  createdBy: string | null,
): Promise<GenerationResult> {
  const supabase = await createClient()

  const { data: runRow, error: runError } = await supabase
    .from('delivery_runs')
    .insert({ delivery_date: deliveryDate, created_by: createdBy })
    .select('id, delivery_date, status, notes, confirmed_at')
    .single()

  if (runError) {
    // Ya hay un pedido para esa fecha. No es un error: o alguien más lo creó,
    // o fue un doble clic. Se abre el que existe en lugar de fallar, y sobre
    // todo en lugar de dejar dos pedidos para el mismo día.
    if (runError.code === '23505') {
      const { data: existing } = await supabase
        .from('delivery_runs')
        .select('id, delivery_date, status, notes, confirmed_at')
        .eq('delivery_date', deliveryDate)
        .single()

      if (existing) {
        return {
          run: {
            id: existing.id,
            deliveryDate: existing.delivery_date,
            status: existing.status,
            notes: existing.notes,
            confirmedAt: existing.confirmed_at,
          },
          generated: 0,
          skippedByPause: 0,
          alreadyExisted: true,
        }
      }
    }
    throw new Error(`No pude crear el pedido: ${runError.message}`)
  }

  const run: DeliveryRun = {
    id: runRow.id,
    deliveryDate: runRow.delivery_date,
    status: runRow.status,
    notes: runRow.notes,
    confirmedAt: runRow.confirmed_at,
  }

  const [{ data: candidates }, { data: pauses }, { data: products }, lastPrices] =
    await Promise.all([
      supabase
        .from('customers')
        .select(
          'id, seller_id, recurrence, biweekly_anchor, ' +
            'standing_order_items(product_id, quantity)',
        )
        .eq('active', true)
        .in('recurrence', ['semanal', 'quincenal']),
      supabase
        .from('customer_pauses')
        .select('customer_id')
        .lte('starts_on', deliveryDate)
        .gte('ends_on', deliveryDate),
      supabase.from('products').select('id, list_price_cop'),
      getLastPrices(),
    ])

  const paused = new Set((pauses ?? []).map((p) => p.customer_id as string))
  const listPrice = new Map(
    (products ?? []).map((p) => [p.id as string, p.list_price_cop as number]),
  )

  let skippedByPause = 0
  const orderRows: { run_id: string; customer_id: string; seller_id: string | null }[] = []
  const standingByCustomer = new Map<string, { product_id: string; quantity: number }[]>()

  for (const row of candidates ?? []) {
    const c = row as unknown as {
      id: string
      seller_id: string | null
      recurrence: 'semanal' | 'quincenal'
      biweekly_anchor: string | null
      standing_order_items: { product_id: string; quantity: number }[]
    }

    if (paused.has(c.id)) {
      skippedByPause++
      continue
    }
    if (c.recurrence === 'quincenal' && !biweeklyMatches(c.biweekly_anchor, deliveryDate)) {
      continue
    }

    orderRows.push({ run_id: run.id, customer_id: c.id, seller_id: c.seller_id })
    standingByCustomer.set(c.id, c.standing_order_items ?? [])
  }

  if (orderRows.length === 0) return { run, generated: 0, skippedByPause }

  const { data: createdOrders, error: ordersError } = await supabase
    .from('orders')
    .insert(orderRows)
    .select('id, customer_id')

  if (ordersError) {
    throw new Error(`No pude generar las órdenes: ${ordersError.message}`)
  }

  const itemRows = (createdOrders ?? []).flatMap((o) =>
    (standingByCustomer.get(o.customer_id) ?? []).map((item) => ({
      order_id: o.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price_cop:
        lastPrices.get(`${o.customer_id}:${item.product_id}`) ??
        listPrice.get(item.product_id) ??
        0,
    })),
  )

  if (itemRows.length > 0) {
    const { error } = await supabase.from('order_items').insert(itemRows)
    if (error) throw new Error(`No pude cargar los productos: ${error.message}`)

    for (const order of createdOrders ?? []) await recalcOrderTotal(order.id)
  }

  return { run, generated: createdOrders?.length ?? 0, skippedByPause }
}

/** Agrega un cliente ocasional al pedido, con su pedido habitual si lo tiene. */
export async function addCustomerToRun(
  runId: string,
  customerId: string,
  addedBy: string | null,
): Promise<void> {
  const supabase = await createClient()

  const { data: customer } = await supabase
    .from('customers')
    .select('seller_id, standing_order_items(product_id, quantity)')
    .eq('id', customerId)
    .single()

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      run_id: runId,
      customer_id: customerId,
      seller_id: customer?.seller_id ?? null,
      source: 'manual',
      added_by: addedBy,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ese cliente ya está en el pedido de esta semana.')
    }
    throw new Error(`No pude agregar el cliente: ${error.message}`)
  }

  const standing = (customer?.standing_order_items ?? []) as {
    product_id: string
    quantity: number
  }[]
  if (standing.length === 0) return

  const [{ data: products }, lastPrices] = await Promise.all([
    supabase.from('products').select('id, list_price_cop'),
    getLastPrices(),
  ])
  const listPrice = new Map(
    (products ?? []).map((p) => [p.id as string, p.list_price_cop as number]),
  )

  await supabase.from('order_items').insert(
    standing.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price_cop:
        lastPrices.get(`${customerId}:${item.product_id}`) ??
        listPrice.get(item.product_id) ??
        0,
    })),
  )

  await recalcOrderTotal(order.id)
}

/**
 * Recalcula el total de una orden desde sus líneas.
 *
 * Lo que se congela al confirmar es el PRECIO de cada línea, que ya queda
 * guardado en `unit_price_cop`. El total no necesita congelarse: derivarlo
 * siempre es lo que permite seguir corrigiendo un pedido después de
 * confirmado sin que la cartera quede mintiendo.
 */
async function recalcOrderTotal(orderId: string): Promise<void> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('order_items')
    .select('subtotal_cop')
    .eq('order_id', orderId)

  const total = (data ?? []).reduce((sum, i) => sum + (i.subtotal_cop ?? 0), 0)
  await supabase.from('orders').update({ total_cop: total }).eq('id', orderId)
}

export async function removeOrder(orderId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('orders').delete().eq('id', orderId)
  if (error) throw new Error(`No pude quitar el cliente: ${error.message}`)
}

export async function setOrderItem(
  orderId: string,
  productId: string,
  quantity: number,
  unitPriceCop: number,
): Promise<void> {
  const supabase = await createClient()

  if (quantity <= 0) {
    const { error } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId)
      .eq('product_id', productId)
    if (error) throw new Error(`No pude quitar el producto: ${error.message}`)
    await recalcOrderTotal(orderId)
    return
  }

  const { error } = await supabase.from('order_items').upsert(
    {
      order_id: orderId,
      product_id: productId,
      quantity,
      unit_price_cop: Math.round(unitPriceCop),
    },
    { onConflict: 'order_id,product_id' },
  )

  if (error) throw new Error(`No pude guardar la cantidad: ${error.message}`)
  await recalcOrderTotal(orderId)
}

/**
 * Confirma el pedido: a partir de aquí cuenta como cargo en la cartera.
 *
 * No lo cierra. Un pedido confirmado se sigue editando —en la práctica siempre
 * aparece una corrección después de despachar— y cada cambio se refleja en la
 * cartera del cliente al instante.
 */
export async function confirmRun(runId: string): Promise<number> {
  const supabase = await createClient()

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id')
    .eq('run_id', runId)

  if (error) throw new Error(`No pude leer el pedido: ${error.message}`)

  for (const order of orders ?? []) await recalcOrderTotal(order.id)

  const { error: runError } = await supabase
    .from('delivery_runs')
    .update({ status: 'confirmado', confirmed_at: new Date().toISOString() })
    .eq('id', runId)

  if (runError) throw new Error(`No pude confirmar: ${runError.message}`)
  return orders?.length ?? 0
}

/** La usa la vista de reparto al entregar en la puerta del cliente. */
export async function markDelivered(
  orderId: string,
  deliveredBy: string | null,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'entregado',
      delivered_at: new Date().toISOString(),
      delivered_by: deliveredBy,
    })
    .eq('id', orderId)

  if (error) throw new Error(`No pude marcar la entrega: ${error.message}`)
}

export async function deleteRun(runId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('delivery_runs').delete().eq('id', runId)
  if (error) throw new Error(`No pude borrar el pedido: ${error.message}`)
}
