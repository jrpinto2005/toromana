'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { formatCop, formatQuantity } from '@/lib/money'
import type { DeliveryRun, Order, PausedCustomer } from '@/modules/orders/types'
import {
  addCustomerAction,
  confirmRunAction,
  removeOrderAction,
  setItemAction,
  type RunActionState,
} from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Product = { id: string; name: string; unit: string; listPriceCop: number }
type Candidate = { id: string; name: string }

const initial: RunActionState = { error: null, message: null }

export function RunEditor({
  run,
  orders,
  paused,
  products,
  candidates,
  currentSellerId,
}: {
  run: DeliveryRun
  orders: Order[]
  paused: PausedCustomer[]
  products: Product[]
  candidates: Candidate[]
  currentSellerId: string | null
}) {
  const router = useRouter()
  const editable = run.status === 'borrador'

  const [addState, addAction, adding] = useActionState(addCustomerAction, initial)
  const [confirmState, confirmAction, confirming] = useActionState(
    confirmRunAction,
    initial,
  )

  useEffect(() => {
    if (addState.error) toast.error(addState.error)
    if (addState.message) toast.success(addState.message)
  }, [addState])

  useEffect(() => {
    if (confirmState.error) toast.error(confirmState.error)
    if (confirmState.message) toast.success(confirmState.message)
  }, [confirmState])

  // Los tres vendedores editan el mismo pedido. Cuando uno agrega o quita a
  // alguien, los demás lo ven sin refrescar: es lo que reemplaza el ida y
  // vuelta por WhatsApp que hoy es la principal fuente de error.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`run:${run.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `run_id=eq.${run.id}` },
        () => router.refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => router.refresh(),
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [run.id, router])

  return (
    <div className="space-y-6">
      {editable && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
          <AddCustomer runId={run.id} candidates={candidates} action={addAction} pending={adding} />
          <form action={confirmAction} className="ml-auto">
            <input type="hidden" name="runId" value={run.id} />
            <Button type="submit" disabled={confirming}>
              {confirming ? 'Confirmando…' : 'Confirmar pedido'}
            </Button>
          </form>
        </div>
      )}

      {paused.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-sm font-medium">
            {paused.length} cliente{paused.length === 1 ? '' : 's'} fuera esta
            semana por pausa
          </p>
          <ul className="mt-2 space-y-1">
            {paused.map((p) => (
              <li key={p.customerId} className="text-sm text-muted-foreground">
                <span className="line-through">{p.customerName}</span>
                {' — '}
                {p.reason ?? 'sin motivo'} · vuelve el {p.endsOn}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-56">Cliente</TableHead>
              {products.map((p) => (
                <TableHead key={p.id} className="text-center">
                  {p.name}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {p.unit}
                  </span>
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
              {editable && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                products={products}
                runId={run.id}
                editable={editable}
                mine={order.sellerId === currentSellerId}
              />
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={products.length + 2}
                  className="py-10 text-center text-muted-foreground"
                >
                  Este pedido está vacío.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function AddCustomer({
  runId,
  candidates,
  action,
  pending,
}: {
  runId: string
  candidates: Candidate[]
  action: (formData: FormData) => void
  pending: boolean
}) {
  const [query, setQuery] = useState('')

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    return candidates.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6)
  }, [candidates, query])

  return (
    <div className="relative">
      <Input
        placeholder="Agregar cliente ocasional…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-72"
      />
      {matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-72 overflow-hidden rounded-md border bg-background shadow-md">
          {matches.map((c) => (
            <form key={c.id} action={action}>
              <input type="hidden" name="runId" value={runId} />
              <input type="hidden" name="customerId" value={c.id} />
              <button
                type="submit"
                disabled={pending}
                onClick={() => setQuery('')}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {c.name}
              </button>
            </form>
          ))}
        </div>
      )}
    </div>
  )
}

function OrderRow({
  order,
  products,
  runId,
  editable,
  mine,
}: {
  order: Order
  products: Product[]
  runId: string
  editable: boolean
  mine: boolean
}) {
  const byProduct = new Map(order.items.map((i) => [i.productId, i]))

  return (
    <TableRow className={mine ? 'bg-primary/5' : undefined}>
      <TableCell>
        <div className="font-medium">{order.customerName}</div>
        <div className="text-xs text-muted-foreground">
          {order.customerAddress ?? 'Sin dirección'}
        </div>
        {order.source === 'manual' && (
          <Badge variant="secondary" className="mt-1">
            Agregado a mano
          </Badge>
        )}
      </TableCell>

      {products.map((product) => {
        const item = byProduct.get(product.id)
        const offList = item && item.unitPriceCop !== product.listPriceCop

        return (
          <TableCell key={product.id} className="text-center">
            {editable ? (
              <form action={setItemAction} className="inline-flex flex-col items-center gap-1">
                <input type="hidden" name="runId" value={runId} />
                <input type="hidden" name="orderId" value={order.id} />
                <input type="hidden" name="productId" value={product.id} />
                <input
                  type="hidden"
                  name="unitPrice"
                  value={item?.unitPriceCop ?? product.listPriceCop}
                />
                <Input
                  name="quantity"
                  type="number"
                  step="0.25"
                  min="0"
                  defaultValue={item ? item.quantity : ''}
                  placeholder="—"
                  onBlur={(e) => e.currentTarget.form?.requestSubmit()}
                  className="h-8 w-16 text-center"
                />
                {offList && (
                  <span
                    className="text-[11px] text-amber-600"
                    title={`Precio de lista: ${formatCop(product.listPriceCop)}`}
                  >
                    {formatCop(item.unitPriceCop)}
                  </span>
                )}
              </form>
            ) : (
              <span className="tabular-nums">
                {item ? formatQuantity(item.quantity) : '—'}
              </span>
            )}
          </TableCell>
        )
      })}

      <TableCell className="text-right font-medium tabular-nums">
        {formatCop(order.totalCop)}
      </TableCell>

      {editable && (
        <TableCell>
          <form action={removeOrderAction}>
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="orderId" value={order.id} />
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              title={`Quitar a ${order.customerName}`}
            >
              ✕
            </Button>
          </form>
        </TableCell>
      )}
    </TableRow>
  )
}
