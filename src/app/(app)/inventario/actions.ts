'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import {
  createItem,
  recordMovement,
  setConsumption,
  updateItem,
  type InventoryKind,
  type InventoryReason,
} from '@/modules/inventory'

export type InventoryActionState = {
  error: string | null
  message: string | null
}

const REASONS: InventoryReason[] = ['inicial', 'compra', 'ajuste', 'merma']

/**
 * Registra una entrada o una salida.
 *
 * El signo lo pone el motivo, no quien digita: una merma siempre resta, una
 * compra siempre suma. Pedirle a alguien que escriba "-3" a las seis de la
 * mañana es pedirle que se equivoque.
 */
export async function recordMovementAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const itemId = String(formData.get('itemId') ?? '')
  const reason = String(formData.get('reason') ?? '') as InventoryReason
  const quantity = Number(formData.get('quantity') ?? 0)

  if (!itemId) return { error: 'Escoge un ítem.', message: null }
  if (!REASONS.includes(reason)) {
    return { error: 'Escoge un motivo válido.', message: null }
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { error: 'La cantidad tiene que ser mayor que cero.', message: null }
  }

  const sign = reason === 'merma' ? -1 : 1
  const profile = await getProfile()

  try {
    await recordMovement({
      itemId,
      delta: sign * quantity,
      reason,
      note: String(formData.get('note') ?? '').trim() || null,
      createdBy: profile?.id ?? null,
    })
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }

  revalidatePath('/inventario')
  return {
    error: null,
    message: sign > 0 ? 'Entrada registrada.' : 'Salida registrada.',
  }
}

export async function createItemAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const name = String(formData.get('name') ?? '').trim()
  const unit = String(formData.get('unit') ?? '').trim()
  if (!name || !unit) {
    return { error: 'El nombre y la unidad son obligatorios.', message: null }
  }

  const kind = (
    formData.get('kind') === 'insumo' ? 'insumo' : 'producto'
  ) as InventoryKind

  try {
    await createItem({
      name,
      unit,
      kind,
      reorderPoint: Number(formData.get('reorderPoint') ?? 0) || 0,
    })
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }

  revalidatePath('/inventario')
  return { error: null, message: `${name} entró al inventario.` }
}

/** Punto de reposición: por debajo de este número el sistema avisa. */
export async function setReorderPointAction(formData: FormData): Promise<void> {
  const id = String(formData.get('itemId') ?? '')
  const value = Number(formData.get('reorderPoint') ?? 0)
  if (!id || !Number.isFinite(value) || value < 0) return

  await updateItem(id, { reorderPoint: value })
  revalidatePath('/inventario')
}

/** Cuánto insumo se lleva un producto por unidad vendida. */
export async function setConsumptionAction(formData: FormData): Promise<void> {
  const productId = String(formData.get('productId') ?? '')
  const itemId = String(formData.get('itemId') ?? '')
  const qty = Number(formData.get('qtyPerUnit') ?? 0)
  if (!productId || !itemId || !Number.isFinite(qty)) return

  await setConsumption(productId, itemId, qty)
  revalidatePath('/inventario')
}
