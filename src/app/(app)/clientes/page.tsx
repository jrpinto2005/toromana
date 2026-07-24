import { listCustomers, listSellers } from '@/modules/clients'
import { CustomersTable } from './customers-table'
import { NewCustomerDialog } from './new-customer-dialog'

export default async function ClientesPage() {
  const [customers, sellers] = await Promise.all([
    listCustomers({ includeInactive: false }),
    listSellers(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Base única del negocio. Reemplaza las hojas de contactos y de fijos.
          </p>
        </div>
        <NewCustomerDialog sellers={sellers} />
      </div>

      <CustomersTable customers={customers} sellers={sellers} />
    </div>
  )
}
