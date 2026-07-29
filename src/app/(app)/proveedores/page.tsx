import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import {
  listPurchases,
  listSupplierBalances,
  listSuppliers,
} from '@/modules/suppliers'
import { listStock } from '@/modules/inventory'
import { formatCop, formatQuantity } from '@/lib/money'
import { SuppliersPanel } from './suppliers-panel'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const metadata = { title: 'Proveedores · Toromana' }
export const dynamic = 'force-dynamic'

export default async function ProveedoresPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin' && profile.role !== 'contabilidad') redirect('/')

  const [suppliers, balances, items, purchases] = await Promise.all([
    listSuppliers(),
    listSupplierBalances(),
    listStock(),
    listPurchases({ limit: 30 }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Proveedores</h1>
        <p className="text-sm text-muted-foreground">
          Lo que se debe y lo que se compró. Cada compra entra al inventario en
          el mismo movimiento.
        </p>
      </div>

      <SuppliersPanel
        suppliers={suppliers}
        balances={balances}
        items={items}
      />

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Últimas compras</h2>

        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Qué entró</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {p.purchaseDate}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.supplierName}
                    {p.invoiceNumber && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        Factura {p.invoiceNumber}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.items
                      .map(
                        (i) =>
                          `${formatQuantity(i.quantity)} ${i.itemName.toLowerCase()}`,
                      )
                      .join(' · ')}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCop(p.totalCop)}
                  </TableCell>
                </TableRow>
              ))}

              {purchases.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Ninguna compra registrada todavía.
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
