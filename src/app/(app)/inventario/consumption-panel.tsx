'use client'

import type { ConsumptionRule } from '@/modules/inventory/types'
import { setConsumptionAction } from './actions'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Product = { id: string; name: string; unit: string }
type Item = { id: string; name: string; unit: string }

/**
 * Qué se lleva cada venta.
 *
 * Es la tabla que traduce "vendimos 14 cubetas" a "se fueron 28 cartones".
 * Se edita aquí y no en el código porque la relación cambia cuando cambia el
 * empaque, y eso no debería requerir un despliegue.
 */
export function ConsumptionPanel({
  products,
  items,
  rules,
}: {
  products: Product[]
  items: Item[]
  rules: ConsumptionRule[]
}) {
  const byPair = new Map(
    rules.map((r) => [`${r.productId}:${r.itemId}`, r.qtyPerUnit]),
  )

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-medium">Consumo por venta</h2>
        <p className="text-sm text-muted-foreground">
          Cuánto se descuenta de cada ítem por unidad vendida. En blanco, ese
          producto no consume ese ítem.
        </p>
      </div>

      <div className="rounded-lg border bg-background">
        <Table containerClassName="overflow-x-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-44">Producto</TableHead>
              {items.map((item) => (
                <TableHead key={item.id} className="text-center">
                  {item.name}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {item.unit}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {product.unit}
                  </div>
                </TableCell>

                {items.map((item) => {
                  const current = byPair.get(`${product.id}:${item.id}`) ?? null

                  return (
                    <TableCell key={item.id} className="text-center">
                      <form action={setConsumptionAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="itemId" value={item.id} />
                        <Input
                          name="qtyPerUnit"
                          type="number"
                          step="0.25"
                          min="0"
                          defaultValue={current ?? ''}
                          placeholder="—"
                          onWheel={(e) => e.currentTarget.blur()}
                          onBlur={(e) => {
                            const raw = e.currentTarget.value.trim()
                            const next = raw === '' ? 0 : Number(raw)
                            if (Number.isNaN(next)) return
                            if (next === (current ?? 0)) return
                            e.currentTarget.form?.requestSubmit()
                          }}
                          className="no-spinner mx-auto h-8 w-16 text-center"
                        />
                      </form>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
