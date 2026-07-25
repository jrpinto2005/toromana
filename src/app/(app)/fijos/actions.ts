'use server'

import { revalidatePath } from 'next/cache'
import { setRecurrence, setStandingItem } from '@/modules/clients'
import type { Recurrence } from '@/modules/clients/types'

export type FijosState = { error: string | null; message: string | null }

export async function setStandingItemAction(formData: FormData): Promise<void> {
  await setStandingItem(
    String(formData.get('customerId') ?? ''),
    String(formData.get('productId') ?? ''),
    Number(formData.get('quantity') ?? 0),
  )
  revalidatePath('/fijos')
}

export async function addToFijosAction(
  _prev: FijosState,
  formData: FormData,
): Promise<FijosState> {
  const customerId = String(formData.get('customerId') ?? '')
  const recurrence = (String(formData.get('recurrence') ?? 'semanal') ||
    'semanal') as Recurrence

  if (!customerId) return { error: 'Escoge un cliente.', message: null }

  try {
    await setRecurrence(customerId, recurrence)
    revalidatePath('/fijos')
    revalidatePath('/clientes')
    return { error: null, message: 'Cliente agregado a la lista de fijos.' }
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }
}

/**
 * Saca al cliente de los fijos sin borrar su pedido habitual: si vuelve,
 * vuelve con lo mismo que pedía. Irse y regresar es normal en este negocio.
 */
export async function removeFromFijosAction(formData: FormData): Promise<void> {
  await setRecurrence(String(formData.get('customerId') ?? ''), 'ocasional')
  revalidatePath('/fijos')
  revalidatePath('/clientes')
}

export async function changeRecurrenceAction(formData: FormData): Promise<void> {
  await setRecurrence(
    String(formData.get('customerId') ?? ''),
    String(formData.get('recurrence') ?? 'semanal') as Recurrence,
  )
  revalidatePath('/fijos')
}
