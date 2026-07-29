import { createClient } from '@/lib/supabase/server'
import type { InventoryKind, InventoryReason } from './types'

/**
 * Registra un movimiento.
 *
 * Es la única forma de mover el stock. No hay "corregir la existencia a 40":
 * hay "entraron 12" o "se perdieron 3, se rompieron en el trasteo". La
 * diferencia importa cuando alguien pregunta, tres semanas después, por qué
 * faltan frascos.
 */
export async function recordMovement(input: {
  itemId: string
  delta: number
  reason: InventoryReason
  note?: string | null
  createdBy?: string | null
}): Promise<void> {
  if (input.delta === 0) {
    throw new Error('Un movimiento de cero no dice nada; no se registra.')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('inventory_movements').insert({
    item_id: input.itemId,
    delta: input.delta,
    reason: input.reason,
    note: input.note ?? null,
    created_by: input.createdBy ?? null,
  })

  if (error) throw new Error(`No pude registrar el movimiento: ${error.message}`)
}

export async function createItem(input: {
  name: string
  unit: string
  kind: InventoryKind
  reorderPoint?: number
}): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inventory_items')
    .insert({
      name: input.name.trim(),
      unit: input.unit.trim(),
      kind: input.kind,
      reorder_point: input.reorderPoint ?? 0,
    })
    .select('id')
    .single()

  if (error) throw new Error(`No pude crear el ítem: ${error.message}`)
  return data.id
}

export async function updateItem(
  id: string,
  input: { name?: string; unit?: string; reorderPoint?: number; active?: boolean },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.unit !== undefined) patch.unit = input.unit.trim()
  if (input.reorderPoint !== undefined) patch.reorder_point = input.reorderPoint
  if (input.active !== undefined) patch.active = input.active
  if (Object.keys(patch).length === 0) return

  const supabase = await createClient()
  const { error } = await supabase
    .from('inventory_items')
    .update(patch)
    .eq('id', id)

  if (error) throw new Error(`No pude guardar el ítem: ${error.message}`)
}

/**
 * Define cuánto insumo consume un producto por unidad vendida.
 *
 * Cantidad 0 borra la regla: el producto deja de consumir ese insumo.
 */
export async function setConsumption(
  productId: string,
  itemId: string,
  qtyPerUnit: number,
): Promise<void> {
  const supabase = await createClient()

  if (qtyPerUnit <= 0) {
    const { error } = await supabase
      .from('inventory_consumption')
      .delete()
      .eq('product_id', productId)
      .eq('item_id', itemId)
    if (error) throw new Error(`No pude quitar la regla: ${error.message}`)
    return
  }

  const { error } = await supabase
    .from('inventory_consumption')
    .upsert(
      { product_id: productId, item_id: itemId, qty_per_unit: qtyPerUnit },
      { onConflict: 'product_id,item_id' },
    )

  if (error) throw new Error(`No pude guardar la regla: ${error.message}`)
}

/**
 * Recalcula el consumo de una semana a partir de las líneas del pedido.
 *
 * Se llama al confirmar. Es idempotente: volver a llamarla después de editar
 * un pedido confirmado reescribe el consumo en vez de duplicarlo, que es lo
 * que el dominio exige — aquí los pedidos se corrigen después de despachar.
 */
export async function syncRunInventory(runId: string): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('sync_run_inventory', {
    p_run_id: runId,
  })

  if (error) {
    throw new Error(`No pude descontar el inventario: ${error.message}`)
  }
  return Number(data ?? 0)
}
