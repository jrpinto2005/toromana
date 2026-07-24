// Esta llave se salta RLS por completo. Si llegara al navegador, cualquiera
// tendría control total de la base. 'server-only' hace que el build falle antes
// de que eso pueda pasar.
import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente con privilegios de servicio, para operaciones que ningún usuario puede
 * hacer por sí mismo: crear cuentas y restablecer contraseñas.
 *
 * Quien lo use es responsable de verificar el rol antes de llamarlo. El cliente
 * no valida permisos porque, por definición, los tiene todos.
 */
export function createAdminClient() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

  if (!key) {
    throw new Error(
      'Falta SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY) en el entorno.',
    )
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
