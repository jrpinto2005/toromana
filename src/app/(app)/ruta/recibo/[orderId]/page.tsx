import { notFound, redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { getReceipt, type Receipt } from '@/modules/documents'
import { formatCop, formatCopPlain, formatQuantity } from '@/lib/money'
import { formatLongDate } from '@/lib/dates'
import { PrintButton } from '../../imprimir/print-button'

export const dynamic = 'force-dynamic'

/**
 * Recibo de entrega — réplica del documento de Word que el negocio viene
 * entregando desde siempre.
 *
 * La fidelidad no es capricho: el cliente institucional firma este papel y lo
 * archiva. Un documento que se ve distinto cada semana genera preguntas en la
 * recepción del hotel, así que solo cambian los cuatro campos que ya cambiaban
 * a mano: fecha, consecutivo, destinatario y líneas.
 */

const VERDE = '#46685a'
const VERDE_CLARO = '#6e9284'

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
      <style>{`
        @media print {
          header, .no-print { display: none !important; }
          /* Los márgenes los pone la página, no el elemento: así el documento
             conserva su tamaño real en papel en vez de escalarse. */
          @page { size: letter; margin: 0.75in 0.85in; }
        }
      `}</style>

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

function ReceiptSheet({ receipt, last }: { receipt: Receipt; last: boolean }) {
  const { company, purchaseOrder } = receipt

  return (
    <article
      className={`mx-auto mb-6 w-[8.5in] bg-white px-[0.85in] py-[0.75in] text-black shadow-sm print:mb-0 print:w-full print:px-0 print:py-0 print:shadow-none ${
        last ? '' : 'print:break-after-page'
      }`}
      style={{ fontFamily: 'Cambria, Georgia, "Times New Roman", serif' }}
    >
      {/* ── Título a la izquierda, fecha y consecutivo a la derecha ── */}
      <div className="flex items-start justify-between gap-8">
        <h2
          className="text-[20pt] font-normal tracking-[0.02em] text-neutral-600"
          style={{ fontVariant: 'small-caps' }}
        >
          RECIBO DE ENTREGA
        </h2>

        <table
          className="border-collapse text-center"
          style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
        >
          <tbody>
            <tr>
              <th className="w-[42pt] bg-neutral-400 px-2 py-1 text-[7.5pt] font-bold uppercase leading-tight text-white">
                Fecha
              </th>
              <td className="w-[86pt] bg-neutral-100 px-2 py-1 text-[10pt] font-bold">
                {formatLongDate(receipt.deliveryDate)}
              </td>
              <th className="w-[58pt] bg-neutral-400 px-2 py-1 text-[7.5pt] font-bold uppercase leading-tight text-white">
                Recibo No.
              </th>
              <td className="w-[52pt] bg-neutral-100 px-2 py-1 text-[10pt] font-bold">
                {purchaseOrder?.number ?? '—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Destinatario ── */}
      <div className="mt-3 flex justify-end">
        <div className="w-[2.9in]">
          <div
            className="px-2 py-[3px] text-[8pt] font-semibold uppercase tracking-[0.08em] text-white"
            style={{
              backgroundColor: VERDE_CLARO,
              fontFamily: 'Calibri, Arial, sans-serif',
            }}
          >
            Información del destinatario
          </div>
          <div className="mt-1 px-2 text-[10pt] leading-[1.45] text-neutral-800">
            <div className="text-neutral-500">Nombre de la persona o empresa</div>
            <div>{receipt.customerLegalName ?? receipt.customerName}</div>
            {receipt.customerNit && <div>Nit {receipt.customerNit}</div>}
            {receipt.customerLegalName && <div>{receipt.customerName}</div>}
            {receipt.customerAddress && <div>{receipt.customerAddress}</div>}
          </div>
        </div>
      </div>

      {/* ── Emisor ── */}
      <div className="mt-6 text-[10pt] leading-[1.5]">
        <div style={{ fontVariant: 'small-caps' }}>{company.legalName}</div>
        {company.taxId && <div className="font-bold">Nit {company.taxId}</div>}
        {company.brandName && (
          <div className="font-bold text-red-600">{company.brandName}</div>
        )}
      </div>

      {company.contactBlock && (
        <div className="mt-8 whitespace-pre-line text-[10pt] leading-[1.5]">
          {company.contactBlock}
        </div>
      )}

      {/* ── Productos ── */}
      <table className="mt-10 w-full border-collapse text-[9.5pt]">
        <thead>
          <tr style={{ backgroundColor: VERDE, color: 'white' }}>
            <th
              className="px-3 py-[6px] text-center text-[8pt] font-semibold uppercase tracking-[0.1em]"
              style={{ width: '58%' }}
            >
              Descripción
            </th>
            <th className="px-2 py-[6px] text-center text-[8pt] font-semibold uppercase tracking-[0.08em]">
              Qty
            </th>
            <th className="px-2 py-[6px] text-center text-[7.5pt] font-semibold leading-tight">
              Precio/
              <br />
              caja
            </th>
            <th className="px-2 py-[6px] text-center text-[8pt] font-semibold uppercase tracking-[0.08em]">
              Total pkgs
            </th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, index) => (
            <tr key={index} className="align-top">
              <td className="border border-neutral-300 px-3 py-2">
                <div className="flex gap-2">
                  <span>{index + 1}.</span>
                  <span>{item.receiptDescription}</span>
                </div>
                {/* La cláusula de comodato va bajo su línea, como en el original. */}
                {index === 0 && receipt.customerPoNote && (
                  <p className="mt-1 pl-5 text-[7.5pt] leading-[1.35] text-neutral-700">
                    {receipt.customerPoNote}
                  </p>
                )}
              </td>
              <td className="border border-neutral-300 px-2 py-2 text-center">
                {formatQuantity(item.quantity)}
              </td>
              <td className="border border-neutral-300 px-2 py-2 text-center">
                ${formatCopPlain(item.unitPriceCop)}
              </td>
              <td className="border border-neutral-300 px-2 py-2 text-center">
                {formatCop(item.subtotalCop)}
              </td>
            </tr>
          ))}

          {/* Aire al pie, como en el documento original. */}
          <tr>
            <td className="border border-neutral-300 px-3 py-6" />
            <td className="border border-neutral-300" />
            <td className="border border-neutral-300" />
            <td className="border border-neutral-300" />
          </tr>

          <tr>
            <td colSpan={2} />
            <td
              className="px-2 py-[6px] text-right text-[8pt] font-semibold uppercase tracking-[0.1em]"
              style={{ backgroundColor: VERDE, color: 'white' }}
            >
              Total
            </td>
            <td className="bg-neutral-100 px-2 py-[6px] text-center font-medium">
              {formatCop(receipt.totalCop)}
            </td>
          </tr>
        </tbody>
      </table>

      <p
        className="mt-10 text-[7.5pt] uppercase tracking-[0.06em] text-neutral-700"
        style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
      >
        Firma del destinatario _______ ______________________
      </p>

      <div className="mt-6 border-t border-dashed border-neutral-400" />
    </article>
  )
}
