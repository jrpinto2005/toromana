/** Tipos del módulo de proveedores. Sin dependencias de servidor. */

export type Supplier = {
  id: string
  name: string
  nit: string | null
  phone: string | null
  contact: string | null
  notes: string | null
  active: boolean
}

/**
 * Lo que se le debe a un proveedor.
 *
 * Derivado, igual que la cartera del otro lado: compras menos pagos. Un saldo
 * guardado se desincroniza en cuanto alguien corrige una factura.
 */
export type SupplierBalance = {
  id: string
  name: string
  active: boolean
  purchasedCop: number
  paidCop: number
  balanceCop: number
  lastPurchaseOn: string | null
}

export type PurchaseItem = {
  id: string
  itemId: string
  itemName: string
  itemUnit: string
  quantity: number
  unitCostCop: number
  subtotalCop: number
}

export type Purchase = {
  id: string
  supplierId: string
  supplierName: string
  purchaseDate: string
  invoiceNumber: string | null
  totalCop: number
  note: string | null
  items: PurchaseItem[]
}

export type SupplierPayment = {
  id: string
  supplierId: string
  paidOn: string
  amountCop: number
  method: 'efectivo' | 'transferencia'
  note: string | null
}
