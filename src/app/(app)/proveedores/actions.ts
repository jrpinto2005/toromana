'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import {
  createPurchase,
  createSupplier,
  deletePurchase,
  registerSupplierPayment,
  updateSupplier,
} from '@/modules/suppliers'

export type SupplierActionState = { error: string | null; message: string | null }

function refresh() {
  revalidatePath('/proveedores')
  // La compra entra al inventario por trigger; la pantalla tiene que reflejarlo.
  revalidatePath('/inventario')
}

export async function createSupplierAction(
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'El nombre es obligatorio.', message: null }

  try {
    await createSupplier({
      name,
      nit: String(formData.get('nit') ?? '').trim() || null,
      phone: String(formData.get('phone') ?? '').trim() || null,
      contact: String(formData.get('contact') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
    })
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }

  refresh()
  return { error: null, message: `${name} quedó registrado.` }
}

export async function updateSupplierAction(
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const id = String(formData.get('supplierId') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!id || !name) return { error: 'El nombre es obligatorio.', message: null }

  try {
    await updateSupplier(id, {
      name,
      nit: String(formData.get('nit') ?? '').trim() || null,
      phone: String(formData.get('phone') ?? '').trim() || null,
      contact: String(formData.get('contact') ?? '').trim() || null,
      notes: String(formData.get('notes') ?? '').trim() || null,
      active: formData.get('active') !== 'false',
    })
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }

  refresh()
  return { error: null, message: `${name} quedó actualizado.` }
}

/**
 * Registra una compra completa.
 *
 * Las líneas llegan como arreglos paralelos del formulario: una fila por ítem
 * del inventario, y solo entran las que traen cantidad.
 */
export async function createPurchaseAction(
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const supplierId = String(formData.get('supplierId') ?? '')
  const purchaseDate = String(formData.get('purchaseDate') ?? '')
  if (!supplierId) return { error: 'Escoge un proveedor.', message: null }
  if (!purchaseDate) return { error: 'Escoge la fecha.', message: null }

  const itemIds = formData.getAll('itemId').map(String)
  const quantities = formData.getAll('quantity').map((v) => Number(v) || 0)
  const costs = formData.getAll('unitCost').map((v) => Number(v) || 0)

  const items = itemIds
    .map((itemId, i) => ({
      itemId,
      quantity: quantities[i] ?? 0,
      unitCostCop: Math.round(costs[i] ?? 0),
    }))
    .filter((line) => line.quantity > 0)

  if (items.length === 0) {
    return { error: 'Ponle cantidad a por lo menos un ítem.', message: null }
  }

  const profile = await getProfile()

  try {
    await createPurchase({
      supplierId,
      purchaseDate,
      invoiceNumber: String(formData.get('invoiceNumber') ?? '').trim() || null,
      note: String(formData.get('note') ?? '').trim() || null,
      createdBy: profile?.id ?? null,
      items,
    })
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }

  refresh()
  return {
    error: null,
    message: `Compra registrada: ${items.length} ítem(s) entraron al inventario.`,
  }
}

export async function registerSupplierPaymentAction(
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const supplierId = String(formData.get('supplierId') ?? '')
  const amountCop = Math.round(Number(formData.get('amountCop') ?? 0))
  if (!supplierId) return { error: 'Escoge un proveedor.', message: null }
  if (!Number.isFinite(amountCop) || amountCop <= 0) {
    return { error: 'El monto tiene que ser mayor que cero.', message: null }
  }

  const profile = await getProfile()

  try {
    await registerSupplierPayment({
      supplierId,
      amountCop,
      paidOn:
        String(formData.get('paidOn') ?? '') ||
        new Date().toISOString().slice(0, 10),
      method:
        formData.get('method') === 'efectivo' ? 'efectivo' : 'transferencia',
      note: String(formData.get('note') ?? '').trim() || null,
      createdBy: profile?.id ?? null,
    })
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }

  refresh()
  return { error: null, message: 'Pago registrado.' }
}

export async function deletePurchaseAction(formData: FormData): Promise<void> {
  await deletePurchase(String(formData.get('purchaseId') ?? ''))
  refresh()
}
