import { notFound, redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import {
  getActiveRun,
  getReceipt,
  getRun,
  listInstitutionalOrderIds,
} from '@/modules/documents'
import { formatWeekdayDate } from '@/lib/dates'
import { EmptyState } from '@/components/empty-state'
import { PrintButton } from '../imprimir/print-button'
import { ReceiptSheet, RECEIPT_PRINT_CSS } from '../recibo/receipt-sheet'

export const dynamic = 'force-dynamic'

/**
 * Todos los recibos institucionales de la semana, encadenados para una sola
 * impresión.
 *
 * Cada cliente aporta tantas hojas como copias tenga configuradas —los
 * institucionales firman por duplicado—, y cada hoja es una página. El salto de
 * página va en todas menos en la última: una hoja en blanco al final es papel
 * perdido cada semana.
 */
export default async function InstitutionalReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const { run: requested } = await searchParams
  const run = requested ? await getRun(requested) : await getActiveRun()
  if (!run) notFound()

  const orderIds = await listInstitutionalOrderIds(run.id)
  const receipts = (await Promise.all(orderIds.map(getReceipt))).filter(
    (r) => r !== null,
  )

  // Una hoja por copia, aplanadas para saber cuál es la última del bloque.
  const sheets = receipts.flatMap((receipt) =>
    Array.from({ length: receipt.purchaseOrder?.copies ?? 1 }, () => receipt),
  )

  return (
    <div className="bg-neutral-100 py-6 print:bg-white print:py-0">
      <style>{RECEIPT_PRINT_CSS}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[8.5in] items-center justify-between gap-4 px-4">
        <div>
          <h1 className="text-xl font-semibold capitalize">
            {formatWeekdayDate(run.deliveryDate)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {receipts.length} cliente{receipts.length === 1 ? '' : 's'}{' '}
            institucional{receipts.length === 1 ? '' : 'es'} · {sheets.length}{' '}
            hoja{sheets.length === 1 ? '' : 's'}
          </p>
        </div>
        {sheets.length > 0 && <PrintButton />}
      </div>

      {sheets.length === 0 ? (
        <div className="mx-auto max-w-[8.5in] px-4">
          <EmptyState title="Esta semana no hay entregas institucionales">
            Aquí salen los recibos de los clientes marcados como
            institucionales, listos para imprimir de una sola vez. Si esperabas
            alguno, revisa que el cliente esté marcado como institucional en su
            ficha y que tenga entrega en este pedido.
          </EmptyState>
        </div>
      ) : (
        sheets.map((receipt, index) => (
          <ReceiptSheet
            key={`${receipt.orderId}-${index}`}
            receipt={receipt}
            last={index === sheets.length - 1}
          />
        ))
      )}
    </div>
  )
}
