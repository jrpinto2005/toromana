import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { listPosts } from '@/modules/forum'
import { listCustomers } from '@/modules/clients'
import { listRuns } from '@/modules/orders'
import { ForumBoard } from './forum-board'

export const dynamic = 'force-dynamic'

export default async function ForoPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  // El foro es conversación de operación y cartera; reparto no participa.
  if (profile.role === 'reparto') redirect('/ruta')

  const [posts, customers, runs] = await Promise.all([
    listPosts(),
    listCustomers(),
    listRuns(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Foro</h1>
        <p className="text-sm text-muted-foreground">
          Ideas, pendientes y quejas de clientes. Una nota atada a la semana o
          al cliente sigue estando cuando vuelve a hacer falta — que es lo que
          no pasa en un chat de WhatsApp.
        </p>
      </div>

      <ForumBoard
        posts={posts}
        currentUserId={profile.id}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        runs={runs.map((r) => ({ id: r.id, date: r.deliveryDate }))}
      />
    </div>
  )
}
