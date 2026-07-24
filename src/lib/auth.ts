import { createClient } from '@/lib/supabase/server'

export type UserRole = 'admin' | 'contabilidad' | 'produccion' | 'reparto'

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
