'use server'

import { revalidatePath } from 'next/cache'
import { assignSeller, createCustomer, type CustomerInput } from '@/modules/clients'

export type ActionState = { error: string | null; message: string | null }

export async function assignSellerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ids = formData.getAll('customerId').map(String)
  const raw = String(formData.get('sellerId') ?? '')
  const sellerId = raw === 'none' ? null : raw

  if (ids.length === 0) {
    return { error: 'Selecciona al menos un cliente.', message: null }
  }

  try {
    const count = await assignSeller(ids, sellerId)
    revalidatePath('/clientes')
    return {
      error: null,
      message:
        sellerId === null
          ? `${count} cliente(s) quedaron sin vendedor.`
          : `${count} cliente(s) asignados.`,
    }
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }
}

export async function createCustomerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'El nombre es obligatorio.', message: null }

  const sellerId = String(formData.get('sellerId') ?? '')
  const input: CustomerInput = {
    name,
    address: String(formData.get('address') ?? '').trim() || null,
    phone: String(formData.get('phone') ?? '').trim() || null,
    sellerId: sellerId && sellerId !== 'none' ? sellerId : null,
    kind: formData.get('kind') === 'institucional' ? 'institucional' : 'natural',
    recurrence:
      (formData.get('recurrence') as CustomerInput['recurrence']) ?? 'ocasional',
  }

  // Los institucionales siempre firman orden de compra por duplicado.
  if (input.kind === 'institucional') {
    input.requiresPurchaseOrder = true
    input.poCopies = 2
  }

  try {
    await createCustomer(input)
    revalidatePath('/clientes')
    return { error: null, message: `${name} quedó creado.` }
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }
}
