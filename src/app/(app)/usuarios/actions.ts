'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export type ResetState = {
  error: string | null
  password: string | null
  userName: string | null
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** Sin caracteres ambiguos: esta clave se dicta por teléfono o por WhatsApp. */
function generatePassword(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  // La llave de servicio puede todo, así que el permiso se verifica AQUÍ.
  // Sin esta guarda, cualquier usuario autenticado podría cambiarle la
  // contraseña al administrador.
  const actor = await getProfile()
  if (!actor || actor.role !== 'admin') {
    return {
      error: 'Solo el administrador puede restablecer contraseñas.',
      password: null,
      userName: null,
    }
  }

  const userId = String(formData.get('userId') ?? '')
  const userName = String(formData.get('userName') ?? '')
  if (!userId) {
    return { error: 'Falta el usuario.', password: null, userName: null }
  }

  const password = generatePassword()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })

  if (error) {
    return { error: error.message, password: null, userName: null }
  }

  revalidatePath('/usuarios')
  return { error: null, password, userName }
}
