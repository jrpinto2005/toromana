import Link from 'next/link'
import { listRuns } from '@/modules/orders'
import { formatCop } from '@/lib/money'
import { formatWeekdayDate, nextMonday } from '@/lib/dates'
import { Badge } from '@/components/ui/badge'
import { NewRunForm } from './new-run-form'

const STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  borrador: { label: 'Borrador', variant: 'outline' },
  confirmado: { label: 'Confirmado', variant: 'default' },
  entregado: { label: 'Entregado', variant: 'secondary' },
  cerrado: { label: 'Cerrado', variant: 'secondary' },
}

export default async function PedidosPage() {
  const runs = await listRuns()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Cada semana se arma solo con los clientes fijos. Los tres vendedores
            lo editan al tiempo.
          </p>
        </div>
        <NewRunForm defaultDate={nextMonday()} />
      </div>

      {runs.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-background p-12 text-center">
          <p className="font-medium">Todavía no hay ningún pedido</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea el de esta semana y la lista se llena sola con los 33 clientes
            fijos y su pedido habitual.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border bg-background">
          {runs.map((run) => (
            <Link
              key={run.id}
              href={`/pedidos/${run.id}`}
              className="flex flex-wrap items-center gap-4 p-4 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-52 flex-1">
                <div className="font-medium capitalize">
                  {formatWeekdayDate(run.deliveryDate)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {run.orderCount} entrega{run.orderCount === 1 ? '' : 's'}
                </div>
              </div>
              <div className="text-right font-medium tabular-nums">
                {formatCop(run.totalCop)}
              </div>
              <Badge variant={STATUS[run.status]?.variant ?? 'outline'}>
                {STATUS[run.status]?.label ?? run.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
