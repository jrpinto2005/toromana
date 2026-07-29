import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getRunDetail } from '@/modules/orders'
import { listCustomers, listProducts, listSellers } from '@/modules/clients'
import { getProfile } from '@/lib/auth'
import { formatWeekdayDate } from '@/lib/dates'
import { formatCop } from '@/lib/money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RunEditor } from './run-editor'

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  const { runId } = await params
  const [detail, products, customers, sellers, profile] = await Promise.all([
    getRunDetail(runId),
    listProducts(),
    listCustomers(),
    listSellers(),
    getProfile(),
  ])

  if (!detail) notFound()

  const { run, orders, paused } = detail
  const total = orders.reduce((sum, o) => sum + o.totalCop, 0)
  const inRun = new Set(orders.map((o) => o.customerId))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold capitalize tracking-tight">
              {formatWeekdayDate(run.deliveryDate)}
            </h1>
            <Badge variant={run.status === 'borrador' ? 'outline' : 'default'}>
              {run.status === 'borrador' ? 'Borrador' : 'Confirmado'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {orders.length} entrega{orders.length === 1 ? '' : 's'} ·{' '}
            {formatCop(total)}
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/pedidos" />}>
            Volver
          </Button>
          {/* Los recibos existen desde que se confirma: es ahí donde se
              numeran las órdenes de compra. */}
          {run.status !== 'borrador' && (
            <>
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/ruta/institucional?run=${run.id}`}
                    target="_blank"
                  />
                }
              >
                Recibos institucionales
              </Button>
              <Button variant="outline" render={<Link href="/ruta" />}>
                Ver ruta
              </Button>
            </>
          )}
        </div>
      </div>

      <RunEditor
        run={run}
        orders={orders}
        paused={paused}
        products={products}
        candidates={customers
          .filter((c) => !inRun.has(c.id))
          .map((c) => ({ id: c.id, name: c.name }))}
        sellers={sellers}
        currentSellerId={profile?.id ?? null}
      />
    </div>
  )
}
