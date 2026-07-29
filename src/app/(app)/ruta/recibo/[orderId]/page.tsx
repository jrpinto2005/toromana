import { notFound, redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { getReceipt } from '@/modules/documents'
import { PrintButton } from '../../imprimir/print-button'
import { ReceiptSheet, RECEIPT_PRINT_CSS } from '../receipt-sheet'

export const dynamic = 'force-dynamic'

/** Recibo de una entrega. El documento en sí vive en `ReceiptSheet`. */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params

  const profile = await getProfile()
  if (!profile) redirect('/login')

  const receipt = await getReceipt(orderId)
  if (!receipt) notFound()

  const copies = receipt.purchaseOrder?.copies ?? 1

  return (
    <div className="bg-neutral-100 py-6 print:bg-white print:py-0">
      <style>{RECEIPT_PRINT_CSS}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[8.5in] items-center justify-between px-4">
        <div>
          <h1 className="text-xl font-semibold">Recibo de entrega</h1>
          <p className="text-sm text-muted-foreground">
            {copies > 1
              ? 'Por duplicado: una copia la firma el cliente, la otra se queda el negocio.'
              : 'Una copia.'}
          </p>
        </div>
        <PrintButton />
      </div>

      {Array.from({ length: copies }).map((_, index) => (
        <ReceiptSheet key={index} receipt={receipt} last={index === copies - 1} />
      ))}
    </div>
  )
}
