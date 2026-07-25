'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { formatCop } from '@/lib/money'
import type { Product } from '@/modules/clients/types'
import {
  addToFijosAction,
  changeRecurrenceAction,
  removeFromFijosAction,
  setStandingItemAction,
  type FijosState,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Fijo = {
  id: string
  name: string
  address: string | null
  recurrence: string
  items: Record<string, number>
}

const initial: FijosState = { error: null, message: null }

export function FijosTable({
  fijos,
  candidates,
  products,
}: {
  fijos: Fijo[]
  candidates: { id: string; name: string }[]
  products: Product[]
}) {
  const [search, setSearch] = useState('')
  const [addState, addAction, adding] = useActionState(addToFijosAction, initial)

  useEffect(() => {
    if (addState.error) toast.error(addState.error)
    if (addState.message) toast.success(addState.message)
  }, [addState])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (q.length < 2) return []
    return candidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8)
  }, [candidates, search])

  // Lo que habría que producir cada semana si todos los fijos piden lo suyo.
  const totals = products.map((p) => ({
    product: p,
    quantity: fijos.reduce((sum, f) => sum + (f.items[p.id] ?? 0), 0),
  }))
  const weeklyValue = totals.reduce(
    (sum, t) => sum + t.quantity * t.product.listPriceCop,
    0,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
        <div className="relative">
          <Input
            placeholder="Agregar un cliente a la lista de fijos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80"
          />
          {matches.length > 0 && (
            <div className="absolute z-20 mt-1 w-80 overflow-hidden rounded-md border bg-background shadow-md">
              {matches.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted">
                  <span className="truncate text-sm">{c.name}</span>
                  <div className="flex shrink-0 gap-1">
                    {(['semanal', 'quincenal'] as const).map((r) => (
                      <form key={r} action={addAction} onSubmit={() => setSearch('')}>
                        <input type="hidden" name="customerId" value={c.id} />
                        <input type="hidden" name="recurrence" value={r} />
                        <Button type="submit" size="sm" variant="outline" disabled={adding}>
                          {r === 'semanal' ? 'Semanal' : 'Quincenal'}
                        </Button>
                      </form>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {fijos.length} fijos · {formatCop(weeklyValue)} por semana a precio de lista
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Cliente</TableHead>
              <TableHead className="w-28">Frecuencia</TableHead>
              {products.map((p) => (
                <TableHead key={p.id} className="text-center">
                  {p.name}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {p.unit}
                  </span>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {fijos.map((f) => (
              <TableRow key={f.id}>
                <TableCell>
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {f.address ?? 'Sin dirección'}
                  </div>
                </TableCell>

                <TableCell>
                  <form action={changeRecurrenceAction}>
                    <input type="hidden" name="customerId" value={f.id} />
                    <select
                      name="recurrence"
                      defaultValue={f.recurrence}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                    </select>
                  </form>
                </TableCell>

                {products.map((p) => (
                  <TableCell key={p.id} className="text-center">
                    <form action={setStandingItemAction} className="inline">
                      <input type="hidden" name="customerId" value={f.id} />
                      <input type="hidden" name="productId" value={p.id} />
                      <Input
                        name="quantity"
                        type="number"
                        step="1"
                        min="0"
                        defaultValue={f.items[p.id] ?? ''}
                        placeholder="—"
                        onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                        className="h-8 w-16 text-center"
                      />
                    </form>
                  </TableCell>
                ))}

                <TableCell>
                  <form action={removeFromFijosAction}>
                    <input type="hidden" name="customerId" value={f.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      title={`Sacar a ${f.name} de los fijos (no borra su pedido habitual)`}
                    >
                      ✕
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}

            {fijos.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={products.length + 3}
                  className="py-10 text-center text-muted-foreground"
                >
                  No hay clientes fijos. Agrega uno con el buscador de arriba.
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {fijos.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Total semanal
                </TableCell>
                {totals.map((t) => (
                  <TableCell key={t.product.id} className="text-center font-medium tabular-nums">
                    {t.quantity || '—'}
                  </TableCell>
                ))}
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}
