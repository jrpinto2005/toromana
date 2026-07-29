'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import {
  addCustomerToRun,
  confirmRun,
  createRun,
  deleteRun,
  removeOrder,
  setOrderItem,
} from '@/modules/orders'
import { createCustomer, type CustomerInput } from '@/modules/clients'
import { generatePurchaseOrdersForRun } from '@/modules/documents'
import { syncRunInventory } from '@/modules/inventory'

/**
 * Pone el inventario al día con las líneas del pedido.
 *
 * Se llama también al editar, no solo al confirmar: aquí un pedido confirmado
 * se sigue corrigiendo, y el inventario tiene que seguir la corrección igual
 * que la sigue la cartera. Para un borrador la función de base de datos no
 * hace nada, así que llamarla de más sale barato.
 *
 * Nunca lanza. Que el descuento falle no puede impedir que se guarde la
 * cantidad que alguien acaba de digitar.
 */
async function syncInventoryQuietly(runId: string): Promise<void> {
  try {
    await syncRunInventory(runId)
  } catch (e) {
    console.error('[inventario] no pude sincronizar el pedido', runId, e)
  }
}

export type RunActionState = { error: string | null; message: string | null }

export async function createRunAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  const deliveryDate = String(formData.get('deliveryDate') ?? '')
  if (!deliveryDate) {
    return { error: 'Escoge la fecha de entrega.', message: null }
  }

  const profile = await getProfile()
  let runId: string

  try {
    const result = await createRun(deliveryDate, profile?.id ?? null)
    runId = result.run.id
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }

  revalidatePath('/pedidos')
  redirect(`/pedidos/${runId}`)
}

export async function addCustomerAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  const runId = String(formData.get('runId') ?? '')
  const customerId = String(formData.get('customerId') ?? '')
  if (!customerId) return { error: 'Escoge un cliente.', message: null }

  const profile = await getProfile()
  try {
    await addCustomerToRun(runId, customerId, profile?.id ?? null)
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }

  revalidatePath(`/pedidos/${runId}`)
  return { error: null, message: 'Cliente agregado.' }
}

/**
 * Crea un cliente y lo mete al pedido en un solo paso.
 *
 * Quien arma el pedido está al teléfono con alguien que acaba de encargar, y
 * hasta ahora tenía que irse a Clientes, crearlo, volver y buscarlo. Ese rodeo
 * es justo el que empuja a anotar el encargo aparte "para meterlo después", y
 * lo que se anota aparte se pierde.
 */
export async function createAndAddCustomerAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  const runId = String(formData.get('runId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'El nombre es obligatorio.', message: null }

  const sellerId = String(formData.get('sellerId') ?? '')
  const profile = await getProfile()

  const input: CustomerInput = {
    name,
    address: String(formData.get('address') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    sellerId: sellerId && sellerId !== 'none' ? sellerId : null,
    kind: formData.get('kind') === 'institucional' ? 'institucional' : 'natural',
    // Ocasional por defecto: se está creando para esta semana. Si resulta ser
    // fijo, se cambia en Clientes y entra solo a partir del próximo pedido.
    recurrence:
      (formData.get('recurrence') as CustomerInput['recurrence']) ?? 'ocasional',
  }

  if (input.kind === 'institucional') {
    input.requiresPurchaseOrder = true
    input.poCopies = 2
  }

  try {
    const customer = await createCustomer(input)
    await addCustomerToRun(runId, customer.id, profile?.id ?? null)
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }

  revalidatePath(`/pedidos/${runId}`)
  revalidatePath('/clientes')
  return { error: null, message: `${name} quedó creado y agregado al pedido.` }
}

export async function removeOrderAction(formData: FormData): Promise<void> {
  const runId = String(formData.get('runId') ?? '')
  await removeOrder(String(formData.get('orderId') ?? ''))
  await syncInventoryQuietly(runId)
  revalidatePath(`/pedidos/${runId}`)
}

export async function setItemAction(formData: FormData): Promise<void> {
  const runId = String(formData.get('runId') ?? '')
  await setOrderItem(
    String(formData.get('orderId') ?? ''),
    String(formData.get('productId') ?? ''),
    Number(formData.get('quantity') ?? 0),
    Number(formData.get('unitPrice') ?? 0),
  )
  await syncInventoryQuietly(runId)
  revalidatePath(`/pedidos/${runId}`)
}

export async function confirmRunAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  const runId = String(formData.get('runId') ?? '')
  try {
    const count = await confirmRun(runId)

    // Aquí es donde nacen los consecutivos de los recibos. Se hace al
    // confirmar y no antes: un número de recibo emitido para un pedido que
    // todavía se está armando es un número quemado.
    const { generated } = await generatePurchaseOrdersForRun(runId)

    // El inventario sale con el pedido: lo comprometido deja de estar
    // disponible. Se hace después de confirmar porque la función de base de
    // datos no toca nada mientras el pedido siga en borrador.
    await syncInventoryQuietly(runId)

    revalidatePath(`/pedidos/${runId}`)
    revalidatePath('/pedidos')
    revalidatePath('/ruta')
    revalidatePath('/inventario')

    const extra = generated > 0 ? ` ${generated} orden(es) de compra numeradas.` : ''
    return {
      error: null,
      message: `Pedido confirmado: ${count} entrega(s). Ya cuenta en la cartera.${extra}`,
    }
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }
}

export async function deleteRunAction(formData: FormData): Promise<void> {
  await deleteRun(String(formData.get('runId') ?? ''))
  revalidatePath('/pedidos')
  redirect('/pedidos')
}
