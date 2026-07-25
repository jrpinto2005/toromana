'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export type MapState = { error: string | null; message: string | null }

/**
 * Marca dónde queda un cliente.
 *
 * Se hace con un clic en el mapa y no geocodificando la dirección. Las
 * direcciones de este negocio son "Parex", "Edificio", "Debajo de la casa":
 * un geocodificador devolvería un punto inventado, y un pin inventado en un
 * mapa de reparto es peor que ningún pin. Se marca una vez y queda.
 */
export async function setCustomerLocationAction(
  _prev: MapState,
  formData: FormData,
): Promise<MapState> {
  const profile = await getProfile()
  if (!profile || profile.role === 'reparto') {
    return { error: 'No tienes permiso para mover ubicaciones.', message: null }
  }

  const customerId = String(formData.get('customerId') ?? '')
  const lat = Number(formData.get('lat'))
  const lng = Number(formData.get('lng'))

  if (!customerId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: 'Faltan las coordenadas.', message: null }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('customers')
    .update({ lat, lng })
    .eq('id', customerId)

  if (error) return { error: error.message, message: null }

  revalidatePath('/mapa')
  return { error: null, message: 'Ubicación guardada.' }
}

/**
 * Reporta dónde va quien reparte.
 *
 * Cada posición se guarda como una fila nueva en vez de sobrescribir la
 * anterior: así queda el recorrido del día, que sirve para saber por dónde
 * pasó una entrega que el cliente dice no haber recibido.
 */
export async function reportPositionAction(
  lat: number,
  lng: number,
  accuracy: number | null,
  runId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile()
  if (!profile) return { ok: false, error: 'Sesión expirada.' }

  const supabase = await createClient()
  const { error } = await supabase.from('delivery_positions').insert({
    profile_id: profile.id,
    run_id: runId,
    lat,
    lng,
    accuracy_m: accuracy,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
