'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { createPost } from '@/modules/forum'
import { formatLongDate } from '@/lib/dates'

export type PurchaseState = { error: string | null; message: string | null }

/**
 * Manda una compra recomendada al foro como pendiente.
 *
 * Una recomendación que vive solo en una pantalla de analítica se pierde igual
 * que se perdía en el Excel. Convertida en pendiente del foro entra al mismo
 * sitio donde el equipo ya mira sus cosas, queda con autor y fecha, y alguien
 * puede darle "resuelto" cuando el pedido esté hecho.
 */
export async function sendPurchaseToForumAction(
  _prev: PurchaseState,
  formData: FormData,
): Promise<PurchaseState> {
  const profile = await getProfile()
  if (!profile || profile.role === 'reparto') {
    return { error: 'No tienes acceso al foro.', message: null }
  }

  const hens = Number(formData.get('hens') ?? 0)
  const orderBy = String(formData.get('orderBy') ?? '')
  const layingFrom = String(formData.get('layingFrom') ?? '')
  const deficit = Number(formData.get('deficit') ?? 0)

  if (!hens || !orderBy) {
    return { error: 'Faltan datos de la compra.', message: null }
  }

  const urgent = formData.get('urgent') === 'true'

  const body = [
    `Comprar ${hens} pollonas.`,
    '',
    urgent
      ? 'Pedirlas ya: el faltante llega antes de que alcancen a producir.'
      : `Pedirlas antes del ${formatLongDate(orderBy)}.`,
    `Empiezan a producir hacia el ${formatLongDate(layingFrom)}.`,
    '',
    `Sin este lote faltarían unos ${deficit.toLocaleString('es-CO')} huevos por semana.`,
    '',
    'Generado desde el plan de producción.',
  ].join('\n')

  try {
    await createPost({
      authorId: profile.id,
      kind: 'pendiente',
      body,
    })
    revalidatePath('/foro')
    return { error: null, message: 'Quedó como pendiente en el foro.' }
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }
}
