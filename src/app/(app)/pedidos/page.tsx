import Link from 'next/link'
import { listRuns } from '@/modules/orders'
import { formatCop } from '@/lib/money'
import { formatWeekdayDate, nextMonday } from '@/lib/dates'
import { Badge } from '@/components/ui/badge'
import { NewRunForm } from './new-run-form'
import { EmptyState } from '@/components/empty-state'

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
        <EmptyState title="Todavía no hay ningún pedido">
          Crea el de esta semana y la lista se llena sola: entran todos los
          clientes fijos con su pedido habitual y al último precio que se les
          cobró. De ahí en adelante los tres vendedores lo editan al tiempo.
        </EmptyState>
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
