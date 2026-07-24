import { redirect } from 'next/navigation'
import { displayIdentity, getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { UsersTable, type TeamMember } from './users-table'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administración',
  contabilidad: 'Contabilidad',
  produccion: 'Producción',
  reparto: 'Reparto',
}

export default async function UsuariosPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin') redirect('/')

  const supabase = await createClient()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_seller')
    .order('full_name')

  // El correo vive en auth.users, que no es accesible con la llave pública.
  const admin = createAdminClient()
  const { data: accounts } = await admin.auth.admin.listUsers()
  const emailById = new Map(accounts.users.map((u) => [u.id, u.email ?? '']))

  const members: TeamMember[] = (profiles ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name,
    role: p.role,
    roleLabel: ROLE_LABEL[p.role] ?? p.role,
    isSeller: p.is_seller,
    identity: displayIdentity(emailById.get(p.id) ?? ''),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          El registro está cerrado: las cuentas se crean aquí. Quien no tiene
          correo entra con su usuario a secas.
        </p>
      </div>

      <UsersTable members={members} />
    </div>
  )
}
