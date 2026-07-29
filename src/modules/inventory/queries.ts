import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type {
  ConsumptionRule,
  InventoryMovement,
  InventoryReason,
  StockLevel,
} from './types'

type StockRow = {
  id: string
  name: string
  unit: string
  kind: StockLevel['kind']
  reorder_point: number
  sort_order: number
  active: boolean
  stock: number
  below_reorder: boolean
}

function toStockLevel(row: StockRow): StockLevel {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    kind: row.kind,
    reorderPoint: Number(row.reorder_point),
    sortOrder: row.sort_order,
    active: row.active,
    stock: Number(row.stock),
    belowReorder: row.below_reorder,
  }
}

/** Existencias actuales, derivadas del libro de movimientos. */
export async function listStock(
  options: { includeInactive?: boolean } = {},
): Promise<StockLevel[]> {
  const supabase = await createClient()
  let query = supabase.from('v_inventory_stock').select('*')
  if (!options.includeInactive) query = query.eq('active', true)

  const { data, error } = await query.order('sort_order')
  if (error) throw new Error(`No pude cargar el inventario: ${error.message}`)

  return (data ?? []).map((row) => toStockLevel(row as StockRow))
}

/** Solo lo que está en o por debajo del punto de reposición. */
export async function listLowStock(): Promise<StockLevel[]> {
  return (await listStock()).filter((item) => item.belowReorder)
}

/**
 * Lo escaso, sin sesión de usuario.
 *
 * El aviso automático corre desde un cron: no hay nadie autenticado, así que
 * RLS bloquearía la lectura normal. Se usa la llave de servicio, y por eso
 * esta función solo lee — nunca escribe ni recibe parámetros del exterior.
 */
export async function listLowStockAsService(): Promise<StockLevel[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('v_inventory_stock')
    .select('*')
    .eq('active', true)
    .order('sort_order')

  if (error) throw new Error(`No pude revisar el inventario: ${error.message}`)

  return (data as StockRow[])
    .map(toStockLevel)
    .filter((item) => item.belowReorder)
}

export async function listMovements(
  options: { itemId?: string; limit?: number } = {},
): Promise<InventoryMovement[]> {
  const supabase = await createClient()
  let query = supabase
    .from('inventory_movements')
    .select(
      'id, item_id, delta, reason, note, created_at, ' +
        'inventory_items(name), profiles(full_name)',
    )

  if (options.itemId) query = query.eq('item_id', options.itemId)

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 100)

  if (error) throw new Error(`No pude cargar los movimientos: ${error.message}`)

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      item_id: string
      delta: number
      reason: InventoryReason
      note: string | null
      created_at: string
      inventory_items: { name: string } | null
      profiles: { full_name: string } | null
    }
    return {
      id: r.id,
      itemId: r.item_id,
      itemName: r.inventory_items?.name ?? 'Ítem',
      delta: Number(r.delta),
      reason: r.reason,
      note: r.note,
      createdAt: r.created_at,
      createdByName: r.profiles?.full_name ?? null,
    }
  })
}

/** Las reglas de consumo: qué producto se lleva cuánto de qué insumo. */
export async function listConsumption(): Promise<ConsumptionRule[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_consumption')
    .select('product_id, item_id, qty_per_unit, products(name), inventory_items(name, unit)')

  if (error) {
    throw new Error(`No pude cargar las reglas de consumo: ${error.message}`)
  }

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      product_id: string
      item_id: string
      qty_per_unit: number
      products: { name: string } | null
      inventory_items: { name: string; unit: string } | null
    }
    return {
      productId: r.product_id,
      productName: r.products?.name ?? 'Producto',
      itemId: r.item_id,
      itemName: r.inventory_items?.name ?? 'Ítem',
      itemUnit: r.inventory_items?.unit ?? '',
      qtyPerUnit: Number(r.qty_per_unit),
    }
  })
}
