'use server'

import { revalidatePath } from 'next/cache'
import { getProfile, toEmail, type UserRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export type ResetState = {
  error: string | null
  password: string | null
  userName: string | null
}

export type PermissionState = { error: string | null; message: string | null }

const ROLES: UserRole[] = ['admin', 'contabilidad', 'produccion', 'reparto']

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

/**
 * Crea una cuenta.
 *
 * El registro público está cerrado: las cuatro personas que usan esto entran
 * porque el administrador las dio de alta. La contraseña se genera aquí y se
 * muestra una sola vez — no se guarda en ninguna parte, y por eso la pantalla
 * insiste en copiarla.
 *
 * Quien no tiene correo entra con su usuario a secas: `toEmail` le pone el
 * dominio interno, que no existe ni recibe nada.
 */
export async function createUserAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const actor = await getProfile()
  if (!actor || actor.role !== 'admin') {
    return {
      error: 'Solo el administrador puede crear cuentas.',
      password: null,
      userName: null,
    }
  }

  const fullName = String(formData.get('fullName') ?? '').trim()
  const identity = String(formData.get('identity') ?? '').trim()
  const role = String(formData.get('role') ?? '') as UserRole
  // Una casilla sin marcar no viaja en el formulario: basta con que exista.
  const isSeller = formData.get('isSeller') !== null

  if (!fullName || !identity) {
    return {
      error: 'El nombre y el usuario son obligatorios.',
      password: null,
      userName: null,
    }
  }
  if (!ROLES.includes(role)) {
    return { error: 'Escoge un rol válido.', password: null, userName: null }
  }

  const password = generatePassword()
  const admin = createAdminClient()

  const { data: created, error } = await admin.auth.admin.createUser({
    email: toEmail(identity),
    password,
    email_confirm: true,
  })

  if (error || !created.user) {
    return {
      error: error?.message ?? 'No pude crear la cuenta.',
      password: null,
      userName: null,
    }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    full_name: fullName,
    role,
    is_seller: isSeller,
  })

  if (profileError) {
    // Una cuenta de Auth sin perfil no puede entrar a ninguna pantalla y no
    // se ve en esta lista: quedaría invisible y bloqueando el usuario.
    await admin.auth.admin.deleteUser(created.user.id)
    return {
      error: `No pude crear el perfil: ${profileError.message}`,
      password: null,
      userName: null,
    }
  }

  revalidatePath('/usuarios')
  return { error: null, password, userName: fullName }
}

/**
 * Cambia el rol y si la persona vende.
 *
 * Con una guarda: no se puede dejar el sistema sin administrador. Es el único
 * rol que puede crear cuentas y restablecer contraseñas, así que quitarlo del
 * todo deja a los cuatro por fuera sin manera de volver a entrar.
 */
export async function updatePermissionsAction(
  _prev: PermissionState,
  formData: FormData,
): Promise<PermissionState> {
  const actor = await getProfile()
  if (!actor || actor.role !== 'admin') {
    return { error: 'Solo el administrador cambia permisos.', message: null }
  }

  const userId = String(formData.get('userId') ?? '')
  const role = String(formData.get('role') ?? '') as UserRole
  // Una casilla sin marcar no viaja en el formulario: basta con que exista.
  const isSeller = formData.get('isSeller') !== null

  if (!userId) return { error: 'Falta el usuario.', message: null }
  if (!ROLES.includes(role)) {
    return { error: 'Escoge un rol válido.', message: null }
  }

  const admin = createAdminClient()

  const { data: target } = await admin
    .from('profiles')
    .select('full_name, role')
    .eq('id', userId)
    .maybeSingle()

  if (!target) return { error: 'Ese usuario ya no existe.', message: null }

  if (target.role === 'admin' && role !== 'admin') {
    const { count } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')

    if ((count ?? 0) <= 1) {
      return {
        error:
          'Es el único administrador. Nombra otro antes de cambiarle el rol, o nadie podrá volver a crear cuentas.',
        message: null,
      }
    }
  }

  const { error } = await admin
    .from('profiles')
    .update({ role, is_seller: isSeller })
    .eq('id', userId)

  if (error) return { error: error.message, message: null }

  revalidatePath('/usuarios')
  revalidatePath('/clientes')
  return { error: null, message: `Permisos de ${target.full_name} guardados.` }
}
