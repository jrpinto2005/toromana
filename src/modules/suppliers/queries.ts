import { createClient } from '@/lib/supabase/server'
import type {
  Purchase,
  PurchaseItem,
  Supplier,
  SupplierBalance,
  SupplierPayment,
} from './types'

export async function listSuppliers(
  options: { includeInactive?: boolean } = {},
): Promise<Supplier[]> {
  const supabase = await createClient()
  let query = supabase
    .from('suppliers')
    .select('id, name, nit, phone, contact, notes, active')

  if (!options.includeInactive) query = query.eq('active', true)

  const { data, error } = await query.order('name')
  if (error) throw new Error(`No pude cargar los proveedores: ${error.message}`)

  return (data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    nit: s.nit,
    phone: s.phone,
    contact: s.contact,
    notes: s.notes,
    active: s.active,
  }))
}

/** Saldos derivados: compras menos pagos, por proveedor. */
export async function listSupplierBalances(): Promise<SupplierBalance[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_supplier_debt')
    .select('*')
    .order('name')

  if (error) throw new Error(`No pude cargar los saldos: ${error.message}`)

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    active: row.active,
    purchasedCop: row.purchased_cop ?? 0,
    paidCop: row.paid_cop ?? 0,
    balanceCop: row.balance_cop ?? 0,
    lastPurchaseOn: row.last_purchase_on ?? null,
  }))
}

export async function listPurchases(
  options: { supplierId?: string; limit?: number } = {},
): Promise<Purchase[]> {
  const supabase = await createClient()
  let query = supabase
    .from('purchases')
    .select(
      `id, supplier_id, purchase_date, invoice_number, total_cop, note,
       suppliers(name),
       purchase_items(id, item_id, quantity, unit_cost_cop, subtotal_cop,
                      inventory_items(name, unit))`,
    )

  if (options.supplierId) query = query.eq('supplier_id', options.supplierId)

  const { data, error } = await query
    .order('purchase_date', { ascending: false })
    .limit(options.limit ?? 50)

  if (error) throw new Error(`No pude cargar las compras: ${error.message}`)

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      supplier_id: string
      purchase_date: string
      invoice_number: string | null
      total_cop: number
      note: string | null
      suppliers: { name: string } | null
      purchase_items: Array<{
        id: string
        item_id: string
        quantity: number
        unit_cost_cop: number
        subtotal_cop: number
        inventory_items: { name: string; unit: string } | null
      }>
    }

    const items: PurchaseItem[] = (r.purchase_items ?? []).map((i) => ({
      id: i.id,
      itemId: i.item_id,
      itemName: i.inventory_items?.name ?? 'Ítem',
      itemUnit: i.inventory_items?.unit ?? '',
      quantity: Number(i.quantity),
      unitCostCop: i.unit_cost_cop,
      subtotalCop: i.subtotal_cop,
    }))

    return {
      id: r.id,
      supplierId: r.supplier_id,
      supplierName: r.suppliers?.name ?? 'Proveedor',
      purchaseDate: r.purchase_date,
      invoiceNumber: r.invoice_number,
      totalCop: r.total_cop,
      note: r.note,
      items,
    }
  })
}

export async function listSupplierPayments(
  supplierId?: string,
): Promise<SupplierPayment[]> {
  const supabase = await createClient()
  let query = supabase
    .from('supplier_payments')
    .select('id, supplier_id, paid_on, amount_cop, method, note')

  if (supplierId) query = query.eq('supplier_id', supplierId)

  const { data, error } = await query
    .order('paid_on', { ascending: false })
    .limit(100)

  if (error) throw new Error(`No pude cargar los pagos: ${error.message}`)

  return (data ?? []).map((p) => ({
    id: p.id,
    supplierId: p.supplier_id,
    paidOn: p.paid_on,
    amountCop: p.amount_cop,
    method: p.method,
    note: p.note,
  }))
}
