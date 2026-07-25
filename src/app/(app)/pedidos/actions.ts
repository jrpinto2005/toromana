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
import { generatePurchaseOrdersForRun } from '@/modules/documents'

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

export async function removeOrderAction(formData: FormData): Promise<void> {
  const runId = String(formData.get('runId') ?? '')
  await removeOrder(String(formData.get('orderId') ?? ''))
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

    revalidatePath(`/pedidos/${runId}`)
    revalidatePath('/pedidos')
    revalidatePath('/ruta')

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
