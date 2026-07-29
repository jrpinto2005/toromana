import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import {
  listConsumption,
  listMovements,
  listStock,
  REASON_LABEL,
} from '@/modules/inventory'
import { listProducts } from '@/modules/clients'
import { formatQuantity } from '@/lib/money'
import { StockPanel } from './stock-panel'
import { ConsumptionPanel } from './consumption-panel'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata = { title: 'Inventario · Toromana' }
export const dynamic = 'force-dynamic'

export default async function InventarioPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role === 'reparto') redirect('/ruta')

  const [items, products, rules, movements] = await Promise.all([
    listStock(),
    listProducts(),
    listConsumption(),
    listMovements({ limit: 40 }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Miel, mermelada y cartones. Baja solo cuando se confirma el pedido de
          la semana; sube cuando se registra una compra.
        </p>
      </div>

      <StockPanel items={items} />

      <ConsumptionPanel
        products={products}
        items={items}
        rules={rules}
      />

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Últimos movimientos</h2>
          <p className="text-sm text-muted-foreground">
            De aquí sale la existencia: es la suma de esta lista.
          </p>
        </div>

        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Ítem</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead>Quién</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString('es-CO', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </TableCell>
                  <TableCell className="font-medium">{m.itemName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {REASON_LABEL[m.reason]}
                    {m.note && ` · ${m.note}`}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${
                      m.delta < 0 ? 'text-destructive' : 'text-emerald-600'
                    }`}
                  >
                    {m.delta > 0 ? '+' : ''}
                    {formatQuantity(m.delta)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {m.createdByName ?? '—'}
                  </TableCell>
                </TableRow>
              ))}

              {movements.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Todavía no hay movimientos. Registra el saldo inicial de
                    cada ítem y de ahí en adelante el pedido semanal lo mueve
                    solo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
