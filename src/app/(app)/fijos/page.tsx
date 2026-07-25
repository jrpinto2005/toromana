import { getAllStandingItems, listCustomers, listProducts } from '@/modules/clients'
import { FijosTable } from './fijos-table'

export default async function FijosPage() {
  const [customers, products, standing] = await Promise.all([
    listCustomers(),
    listProducts(),
    getAllStandingItems(),
  ])

  const fijos = customers.filter((c) => c.recurrence !== 'ocasional')
  const rest = customers.filter((c) => c.recurrence === 'ocasional')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clientes fijos</h1>
        <p className="text-sm text-muted-foreground">
          Lo que cada cliente pide todas las semanas. De aquí se llena solo el
          pedido semanal, así que esta es la lista que hay que mantener al día.
        </p>
      </div>

      <FijosTable
        fijos={fijos.map((c) => ({
          id: c.id,
          name: c.name,
          address: c.address,
          recurrence: c.recurrence,
          items: Object.fromEntries(standing.get(c.id) ?? new Map()),
        }))}
        candidates={rest.map((c) => ({ id: c.id, name: c.name }))}
        products={products}
      />
    </div>
  )
}
