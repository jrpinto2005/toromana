import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getProfile } from '@/lib/auth'
import { countOpenPosts } from '@/modules/forum'
import { logout } from '../(auth)/login/actions'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/brand'
import { navFor } from './nav'
import { NavLinks } from './nav-links'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administración',
  contabilidad: 'Contabilidad',
  produccion: 'Producción',
  reparto: 'Reparto',
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()

  // El middleware ya bloqueó a los no autenticados. Si llegamos aquí sin perfil,
  // el usuario existe en Auth pero nadie le creó su fila en `profiles`.
  if (!profile) redirect('/login')

  // Pendientes y quejas sin resolver, en la pestaña del foro. Es la única
  // cifra que el equipo necesita ver sin entrar a buscarla.
  const openPosts = profile.role === 'reparto' ? 0 : await countOpenPosts()

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <Link href="/" className="transition-opacity hover:opacity-80">
            <Brand />
          </Link>

          <NavLinks items={navFor(profile.role)} badges={{ '/foro': openPosts }} />

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <div className="text-sm font-medium">{profile.fullName}</div>
              <div className="text-xs text-muted-foreground">
                {ROLE_LABEL[profile.role] ?? profile.role}
              </div>
            </div>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
