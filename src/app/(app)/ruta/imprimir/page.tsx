import { notFound, redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { getActiveRun, getRouteStops } from '@/modules/documents'
import { listProducts } from '@/modules/clients'
import { formatQuantity } from '@/lib/money'
import { formatWeekdayDate } from '@/lib/dates'
import { PrintButton } from './print-button'

export const dynamic = 'force-dynamic'

/**
 * Lista de reparto — replica la hoja que hoy se imprime desde Excel: una tabla
 * de cliente × producto con la fila de totales al pie.
 *
 * Solo salen las columnas de los productos que alguien pidió esta semana. La
 * hoja de Excel arrastra siempre las ocho columnas, y quien reparte termina
 * leyendo cuatro vacías; en papel, cada columna de más es una oportunidad de
 * equivocarse de fila.
 */
export default async function PrintRoutePage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const run = await getActiveRun()
  if (!run) notFound()

  const [stops, allProducts] = await Promise.all([
    getRouteStops(run.id),
    listProducts(),
  ])

  const used = new Set(stops.flatMap((s) => s.items.map((i) => i.productId)))
  const columns = allProducts.filter((p) => used.has(p.id))

  const quantityOf = (stopIndex: number, productId: string) =>
    stops[stopIndex].items.find((i) => i.productId === productId)?.quantity ?? 0

  const totals = columns.map((p) =>
    stops.reduce(
      (sum, stop) =>
        sum + (stop.items.find((i) => i.productId === p.id)?.quantity ?? 0),
      0,
    ),
  )

  return (
    <div className="bg-neutral-100 py-6 text-black print:bg-white print:py-0">
      <style>{`
        @media print {
          header, .no-print { display: none !important; }
          @page { size: letter landscape; margin: 0.5in; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex max-w-[10in] items-center justify-between px-4">
        <div>
          <h1 className="text-xl font-semibold capitalize">
            {formatWeekdayDate(run.deliveryDate)}
          </h1>
          <p className="text-sm text-neutral-600">
            {stops.length} entregas · {columns.length} productos
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="mx-auto w-[10in] bg-white p-8 shadow-sm print:w-auto print:p-0 print:shadow-none">
        <table
          className="w-full border-collapse"
          style={{ fontFamily: 'Calibri, Arial, Helvetica, sans-serif', fontSize: '10.5px' }}
        >
          <thead>
            <tr>
              <Th className="w-[2.1in] text-left">Nombre</Th>
              <Th className="text-left">Direccion</Th>
              {columns.map((p) => (
                <Th key={p.id} className="w-[0.85in] text-left">
                  {p.name}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stops.map((stop, index) => (
              <tr key={stop.orderId}>
                <Td>{stop.customerName}</Td>
                <Td>{stop.address ?? ''}</Td>
                {columns.map((p) => {
                  const quantity = quantityOf(index, p.id)
                  return (
                    <Td key={p.id} className="text-right">
                      {quantity ? formatQuantity(quantity) : ''}
                    </Td>
                  )
                })}
              </tr>
            ))}

            <tr>
              <Td>Total</Td>
              <Td />
              {totals.map((total, i) => (
                <Td key={columns[i].id} className="text-right">
                  {total ? formatQuantity(total) : ''}
                </Td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({
  children,
  className = '',
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={`border border-neutral-400 px-2 py-[5px] font-normal ${className}`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className = '',
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <td className={`border border-neutral-400 px-2 py-[5px] ${className}`}>
      {children}
    </td>
  )
}
