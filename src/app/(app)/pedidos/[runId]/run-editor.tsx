'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { formatCop, formatQuantity } from '@/lib/money'
import type { DeliveryRun, Order, PausedCustomer } from '@/modules/orders/types'
import type { Seller } from '@/modules/clients/types'
import {
  addCustomerAction,
  confirmRunAction,
  removeOrderAction,
  setItemAction,
  type RunActionState,
} from '../actions'
import { NewCustomerDialog } from './new-customer-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Product = { id: string; name: string; unit: string; listPriceCop: number }
type Candidate = { id: string; name: string }

const initial: RunActionState = { error: null, message: null }

/**
 * Encabezado y columna de cliente congelados, como los paneles inmovilizados
 * del Excel que esto reemplaza. Con ocho productos y sesenta entregas, sin esto
 * uno termina contando columnas con el dedo para saber qué está digitando.
 *
 * La tabla va en `border-separate`: con `border-collapse` —el default de
 * Tailwind— los bordes de una celda `sticky` se pintan en su posición original
 * y la rejilla se deshace al desplazarse. En modo separado cada celda conserva
 * el suyo, por eso los bordes se declaran en las celdas y no en la fila.
 */
const GRID =
  'border-separate border-spacing-0 [&_td]:border-b [&_th]:border-b'
const STICKY_HEAD = 'sticky top-0 z-20 bg-background'
const STICKY_COL = 'sticky left-0 bg-background'

export function RunEditor({
  run,
  orders,
  paused,
  products,
  candidates,
  sellers,
  currentSellerId,
}: {
  run: DeliveryRun
  orders: Order[]
  paused: PausedCustomer[]
  products: Product[]
  candidates: Candidate[]
  sellers: Seller[]
  currentSellerId: string | null
}) {
  const router = useRouter()
  // Un pedido confirmado se sigue editando: en la práctica siempre aparece una
  // corrección después de despachar, y obligar a rehacerlo empuja a la gente de
  // vuelta al papel. Cada cambio se refleja en la cartera al instante.
  const confirmed = run.status !== 'borrador'

  // El buscador se limpia cuando la acción confirma. Se lleva en un contador
  // y no en un efecto: limpiarlo en el clic desmontaba el formulario antes de
  // que el envío saliera del navegador, y el cliente nunca llegaba a agregarse.
  const [addedCount, setAddedCount] = useState(0)
  const [adding, startTransition] = useTransition()
  const [confirming, startConfirm] = useTransition()

  // Filtro sobre las entregas ya incluidas. Es distinto del buscador que agrega
  // clientes: aquí no se trae a nadie, se va a una fila concreta entre sesenta
  // para corregirle la cantidad.
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(
      (o) =>
        o.customerName.toLowerCase().includes(q) ||
        (o.customerAddress ?? '').toLowerCase().includes(q),
    )
  }, [orders, search])

  const filtering = visible.length !== orders.length

  // Los totales suman lo que está a la vista: es la cifra que se contrasta
  // contra lo que hay que empacar, y tiene que corresponder a lo que se lee.
  const totals = useMemo(() => {
    const byProduct = new Map<string, number>()
    let totalCop = 0
    for (const order of visible) {
      totalCop += order.totalCop
      for (const item of order.items) {
        byProduct.set(
          item.productId,
          (byProduct.get(item.productId) ?? 0) + item.quantity,
        )
      }
    }
    return { byProduct, totalCop }
  }, [visible])

  function addAction(formData: FormData) {
    startTransition(async () => {
      const result = await addCustomerAction(initial, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.message) toast.success(result.message)
      setAddedCount((n) => n + 1)
    })
  }

  function confirmAction(formData: FormData) {
    startConfirm(async () => {
      const result = await confirmRunAction(initial, formData)
      if (result.error) toast.error(result.error)
      else if (result.message) toast.success(result.message)
    })
  }

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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
        {/* La `key` cambia cada vez que se agrega un cliente, y React remonta
            el buscador vacío. Es la forma que React documenta para reiniciar
            estado, y evita el efecto que limpiaba el campo — que además, si se
            hacía en el clic, desmontaba el formulario antes de que el envío
            saliera y el cliente nunca se agregaba. */}
        <AddCustomer
          key={addedCount}
          runId={run.id}
          candidates={candidates}
          action={addAction}
          pending={adding}
        />
        <NewCustomerDialog
          runId={run.id}
          sellers={sellers}
          currentSellerId={currentSellerId}
        />
        <span className="text-xs text-muted-foreground">
          Los cambios se guardan solos.
        </span>
        {!confirmed && (
          <form action={confirmAction} className="ml-auto">
            <input type="hidden" name="runId" value={run.id} />
            <Button type="submit" disabled={confirming}>
              {confirming ? 'Confirmando…' : 'Confirmar pedido'}
            </Button>
          </form>
        )}
      </div>

      {confirmed && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          Pedido confirmado: ya cuenta en la cartera. Se puede seguir editando y
          cada cambio ajusta el saldo del cliente al instante.
        </p>
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

      {orders.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Buscar en este pedido…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <span className="text-sm text-muted-foreground">
            {filtering
              ? `${visible.length} de ${orders.length} entregas`
              : `${orders.length} entrega${orders.length === 1 ? '' : 's'}`}
          </span>
        </div>
      )}

      <div className="rounded-lg border bg-background">
        <Table
          containerClassName="max-h-[70dvh] overflow-auto rounded-lg"
          className={GRID}
        >
          <TableHeader>
            <TableRow>
              <TableHead className={cn(STICKY_HEAD, STICKY_COL, 'z-30 min-w-56')}>
                Cliente
              </TableHead>
              {products.map((p) => (
                <TableHead key={p.id} className={cn(STICKY_HEAD, 'text-center')}>
                  {p.name}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {p.unit}
                  </span>
                </TableHead>
              ))}
              <TableHead className={cn(STICKY_HEAD, 'text-right')}>
                Total
              </TableHead>
              <TableHead className={cn(STICKY_HEAD, 'w-10')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((order, rowIndex) => (
              <OrderRow
                key={order.id}
                order={order}
                products={products}
                runId={run.id}
                rowIndex={rowIndex}
                editable
                mine={order.sellerId === currentSellerId}
              />
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={products.length + 3}
                  className="py-10 text-center text-muted-foreground"
                >
                  {orders.length === 0 ? (
                    <>
                      <span className="font-medium">
                        Este pedido quedó vacío.
                      </span>{' '}
                      Agrega clientes con el buscador de arriba, o revisa en
                      Fijos quién debería entrar solo cada semana.
                    </>
                  ) : (
                    <>
                      Ninguna entrega de este pedido coincide con{' '}
                      <span className="font-medium">{search}</span>.
                    </>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>

          {visible.length > 0 && (
            <TableFooter className="bg-background">
              <TableRow className="hover:bg-transparent">
                <TableCell
                  className={cn(
                    STICKY_COL,
                    'sticky bottom-0 z-30 border-t font-medium',
                  )}
                >
                  {filtering ? 'Total filtrado' : 'Total'}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {visible.length} entrega{visible.length === 1 ? '' : 's'}
                  </span>
                </TableCell>

                {products.map((p) => {
                  const quantity = totals.byProduct.get(p.id) ?? 0
                  return (
                    <TableCell
                      key={p.id}
                      className="sticky bottom-0 z-20 border-t bg-background text-center font-medium tabular-nums"
                    >
                      {quantity ? formatQuantity(quantity) : '—'}
                    </TableCell>
                  )
                })}

                <TableCell className="sticky bottom-0 z-20 border-t bg-background text-right font-semibold tabular-nums">
                  {formatCop(totals.totalCop)}
                </TableCell>
                <TableCell className="sticky bottom-0 z-20 border-t bg-background" />
              </TableRow>
            </TableFooter>
          )}
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
  rowIndex,
  editable,
  mine,
}: {
  order: Order
  products: Product[]
  runId: string
  rowIndex: number
  editable: boolean
  mine: boolean
}) {
  const byProduct = new Map(order.items.map((i) => [i.productId, i]))

  return (
    <TableRow className={mine ? 'bg-primary/5' : undefined}>
      {/* La celda congelada va opaca: si fuera translúcida, las columnas de
          producto se verían por debajo al desplazarse en horizontal. El tinte
          de "mis clientes" se superpone encima para no perderlo. */}
      <TableCell
        className={cn(
          STICKY_COL,
          'relative z-10',
          mine &&
            'before:pointer-events-none before:absolute before:inset-0 before:bg-primary/5',
        )}
      >
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

      {products.map((product, colIndex) => {
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
                <QuantityInput
                  current={item ? item.quantity : null}
                  row={rowIndex}
                  col={colIndex}
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

/**
 * Celda de cantidad.
 *
 * Sin las flechas del navegador: en una rejilla de este ancho se comen espacio,
 * y un clic desviado sube media cubeta sin que nadie lo note. Por lo mismo, la
 * rueda del mouse no edita el valor — suelta el foco y deja pasar el
 * desplazamiento, que ahora ocurre dentro de la tabla.
 *
 * Las flechas arriba y abajo **mueven de celda**, no cambian el número. Es lo
 * que hace un `input[type=number]` por su cuenta, y es exactamente lo contrario
 * de lo que uno espera en una rejilla: se baja a la fila siguiente y en vez de
 * eso el valor de la celda actual se mueve solo. Enter hace lo mismo que la
 * flecha abajo, como en una hoja de cálculo.
 *
 * El `scroll-mt`/`scroll-mb` es para que al saltar de fila el navegador no
 * deje la celda debajo del encabezado congelado o de la fila de totales.
 *
 * Y solo se guarda si el valor cambió: recorrer la fila con Tab disparaba una
 * escritura por celda, cada una con su recálculo de totales y su revalidación.
 */
function QuantityInput({
  current,
  row,
  col,
}: {
  current: number | null
  row: number
  col: number
}) {
  function moveTo(nextRow: number) {
    const target = document.querySelector<HTMLInputElement>(
      `[data-cell="${nextRow}:${col}"]`,
    )
    if (!target) return
    target.focus()
    target.select()
  }

  return (
    <Input
      name="quantity"
      type="number"
      step="0.25"
      min="0"
      data-cell={`${row}:${col}`}
      defaultValue={current ?? ''}
      placeholder="—"
      onWheel={(e) => e.currentTarget.blur()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault()
          moveTo(row + 1)
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          moveTo(row - 1)
        }
      }}
      onBlur={(e) => {
        const raw = e.currentTarget.value.trim()
        const next = raw === '' ? null : Number(raw)
        if (next !== null && Number.isNaN(next)) return
        if (next === current) return
        e.currentTarget.form?.requestSubmit()
      }}
      className="no-spinner h-8 w-16 scroll-mt-16 scroll-mb-16 text-center"
    />
  )
}
