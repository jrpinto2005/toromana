/**
 * Módulo de inventario — API pública.
 *
 * Cuenta miel, mermelada y cartones. El stock se deriva del libro de
 * movimientos, nunca se almacena: es la misma decisión que en cartera, y por
 * la misma razón — un saldo guardado se desincroniza y nadie se entera hasta
 * que falta producto un lunes de madrugada.
 *
 * Los demás módulos importan SOLO desde aquí.
 */

export type {
  ConsumptionRule,
  InventoryKind,
  InventoryMovement,
  InventoryReason,
  StockLevel,
} from './types'
export { KIND_LABEL, REASON_LABEL } from './types'

export {
  listStock,
  listLowStock,
  listLowStockAsService,
  listMovements,
  listConsumption,
} from './queries'

export {
  recordMovement,
  createItem,
  updateItem,
  setConsumption,
  syncRunInventory,
} from './mutations'
