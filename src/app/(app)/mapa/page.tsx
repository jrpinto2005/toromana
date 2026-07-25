import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getActiveRun, getRouteStops } from '@/modules/documents'
import { formatWeekdayDate } from '@/lib/dates'
import { RouteMap, type MapStop } from './route-map'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mapa · Toromana' }

export default async function MapaPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const run = await getActiveRun()
  const supabase = await createClient()

  const [stops, { data: customers }, { data: positions }] = await Promise.all([
    run ? getRouteStops(run.id) : Promise.resolve([]),
    supabase.from('customers').select('id, name, address, lat, lng'),
    supabase
      .from('delivery_positions')
      .select('profile_id, lat, lng, recorded_at, profiles(full_name)')
      .order('recorded_at', { ascending: false })
      .limit(50),
  ])

  const coords = new Map(
    (customers ?? []).map((c) => [c.id, { lat: c.lat, lng: c.lng }]),
  )

  const mapStops: MapStop[] = stops.map((stop, index) => {
    const point = coords.get(stop.customerId)
    return {
      orderId: stop.orderId,
      customerId: stop.customerId,
      name: stop.customerName,
      address: stop.address,
      delivered: stop.status === 'entregado',
      position: index + 1,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    }
  })

  // La última posición de cada quien reparte. Se consultan varias filas y se
  // toma la más reciente por persona: el histórico del día se conserva.
  const seen = new Set<string>()
  const latest = (positions ?? [])
    .filter((p) => {
      if (seen.has(p.profile_id)) return false
      seen.add(p.profile_id)
      return true
    })
    .map((p) => {
      const who = p.profiles as unknown as { full_name: string } | null
      return {
        profileId: p.profile_id,
        name: who?.full_name ?? 'Reparto',
        lat: p.lat as number,
        lng: p.lng as number,
        recordedAt: p.recorded_at as string,
      }
    })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mapa de la ruta</h1>
        <p className="text-sm text-muted-foreground">
          {run
            ? `Entrega del ${formatWeekdayDate(run.deliveryDate)}`
            : 'No hay un pedido confirmado.'}
        </p>
      </div>

      <RouteMap
        stops={mapStops}
        couriers={latest}
        runId={run?.id ?? null}
        canEdit={profile.role !== 'reparto'}
        isCourier={profile.role === 'reparto' || profile.role === 'admin'}
      />
    </div>
  )
}
