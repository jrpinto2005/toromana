import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { USERNAME_DOMAIN } from '@/lib/auth'
import type { EmailRecipient } from './types'

/**
 * A quién se le escribe.
 *
 * Los avisos son internos: van a las cuentas del equipo, nunca a clientes. El
 * correo vive en `auth.users`, que la llave pública no puede leer, así que
 * resolverlo exige el cliente de servicio.
 *
 * Quien no tiene correo —el sistema permite entrar con usuario a secas— queda
 * fuera sin error: no recibir un aviso no es una falla, es una cuenta sin
 * buzón.
 */

export type TeamMemberContact = EmailRecipient & {
  id: string
  role: string
}

async function contactsById(): Promise<Map<string, TeamMemberContact>> {
  const admin = createAdminClient()

  const [{ data: profiles }, accounts] = await Promise.all([
    admin.from('profiles').select('id, full_name, role').order('full_name'),
    admin.auth.admin.listUsers(),
  ])

  const emailById = new Map(
    accounts.data.users.map((u) => [u.id, u.email ?? '']),
  )

  const result = new Map<string, TeamMemberContact>()
  for (const p of profiles ?? []) {
    const email = emailById.get(p.id) ?? ''
    // Un usuario sin correo real —los que entran con usuario a secas llevan
    // un correo sintético que no existe— no puede recibir avisos.
    if (!email || email.endsWith(`@${USERNAME_DOMAIN}`)) continue
    result.set(p.id, {
      id: p.id,
      name: p.full_name,
      email,
      role: p.role,
    })
  }
  return result
}

/** Contactos del equipo, opcionalmente filtrados por rol. */
export async function listTeamContacts(
  roles?: string[],
): Promise<TeamMemberContact[]> {
  const all = [...(await contactsById()).values()]
  if (!roles || roles.length === 0) return all
  return all.filter((c) => roles.includes(c.role))
}

/** Un contacto puntual. `null` si no existe o no tiene buzón. */
export async function getTeamContact(
  profileId: string,
): Promise<TeamMemberContact | null> {
  return (await contactsById()).get(profileId) ?? null
}
