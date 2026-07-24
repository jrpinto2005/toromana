import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'contabilidad' | 'produccion' | 'reparto'

/**
 * Dominio interno para las cuentas que entran con usuario en vez de correo.
 *
 * Supabase Auth exige un correo para autenticar con contraseña, pero no todo el
 * equipo tiene uno ni tiene por qué. Quien reparte escribe "Luis" y aquí se
 * convierte en luis@toromana.local. El dominio no existe ni recibe correo: es
 * solo un identificador interno.
 */
export const USERNAME_DOMAIN = 'toromana.local'

/** Acepta indistintamente un correo real o un usuario suelto. */
export function toEmail(identifier: string): string {
  const value = identifier.trim().toLowerCase()
  return value.includes('@') ? value : `${value}@${USERNAME_DOMAIN}`
}

/** Cómo se le muestra la cuenta al usuario: sin el dominio interno. */
export function displayIdentity(email: string): string {
  return email.endsWith(`@${USERNAME_DOMAIN}`) ? email.split('@')[0] : email
}

export type Profile = {
  id: string
  fullName: string
  role: UserRole
  isSeller: boolean
  phone: string | null
}

/** Perfil del usuario autenticado, o null si no hay sesión. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_seller, phone')
    .eq('id', user.id)
    .single()

  if (!data) return null

  return {
    id: data.id,
    fullName: data.full_name,
    role: data.role,
    isSeller: data.is_seller,
    phone: data.phone,
  }
}

/** Los tres roles que tienen clientes asignados y pueden recibir pagos. */
export function isSeller(role: UserRole): boolean {
  return role === 'admin' || role === 'contabilidad' || role === 'produccion'
}
