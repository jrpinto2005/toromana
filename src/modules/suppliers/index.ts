/**
 * Módulo de proveedores — API pública.
 *
 * El espejo de la cartera: allá se cobra, aquí se debe. Y la compra es además
 * la única entrada legítima de inventario, así que las dos cosas ocurren
 * juntas por construcción.
 *
 * Los demás módulos importan SOLO desde aquí.
 */

export type {
  Purchase,
  PurchaseItem,
  Supplier,
  SupplierBalance,
  SupplierPayment,
} from './types'

export {
  listSuppliers,
  listSupplierBalances,
  listPurchases,
  listSupplierPayments,
} from './queries'

export {
  createSupplier,
  updateSupplier,
  createPurchase,
  deletePurchase,
  registerSupplierPayment,
  type SupplierInput,
} from './mutations'
