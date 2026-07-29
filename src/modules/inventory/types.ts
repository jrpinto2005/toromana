/** Tipos del módulo de inventario. Sin dependencias de servidor. */

export type InventoryKind = 'producto' | 'insumo'

export type InventoryReason =
  | 'inicial'
  | 'compra'
  | 'venta'
  | 'ajuste'
  | 'merma'

export const REASON_LABEL: Record<InventoryReason, string> = {
  inicial: 'Saldo inicial',
  compra: 'Compra',
  venta: 'Venta de la semana',
  ajuste: 'Ajuste',
  merma: 'Merma',
}

export const KIND_LABEL: Record<InventoryKind, string> = {
  producto: 'Producto',
  insumo: 'Insumo',
}

/**
 * Existencia de un ítem.
 *
 * `stock` no está guardado en ninguna columna: sale de sumar el libro de
 * movimientos. Por eso no admite corrección directa — para cambiarlo se
 * registra un movimiento, y así queda el rastro de quién y por qué.
 */
export type StockLevel = {
  id: string
  name: string
  unit: string
  kind: InventoryKind
  reorderPoint: number
  sortOrder: number
  active: boolean
  stock: number
  belowReorder: boolean
}

export type InventoryMovement = {
  id: string
  itemId: string
  itemName: string
  delta: number
  reason: InventoryReason
  note: string | null
  createdAt: string
  createdByName: string | null
}

/** Cuánto insumo se lleva cada unidad vendida de un producto. */
export type ConsumptionRule = {
  productId: string
  productName: string
  itemId: string
  itemName: string
  itemUnit: string
  qtyPerUnit: number
}
