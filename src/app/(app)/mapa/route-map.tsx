'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  reportPositionAction,
  setCustomerLocationAction,
  type MapState,
} from './actions'

export type MapStop = {
  orderId: string
  customerId: string
  name: string
  address: string | null
  delivered: boolean
  position: number
  lat: number | null
  lng: number | null
}

export type Courier = {
  profileId: string
  name: string
  lat: number
  lng: number
  recordedAt: string
}

// Leaflet toca `window` al importarse, así que no puede renderizarse en el
// servidor. Se carga solo en el navegador.
const LeafletMap = dynamic(() => import('./leaflet-map').then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[28rem] w-full items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
      Cargando mapa…
    </div>
  ),
})

const initial: MapState = { error: null, message: null }

/** Cada cuánto se reporta la posición: suficiente para seguir una ruta urbana. */
const REPORT_EVERY_MS = 20_000

export function RouteMap({
  stops,
  couriers,
  runId,
  canEdit,
  isCourier,
}: {
  stops: MapStop[]
  couriers: Courier[]
  runId: string | null
  canEdit: boolean
  isCourier: boolean
}) {
  const router = useRouter()
  const [placing, setPlacing] = useState<MapStop | null>(null)
  const [live, setLive] = useState<Courier[]>(couriers)
  const [, startTransition] = useTransition()

  const missing = stops.filter((s) => s.lat === null)
  const located = stops.length - missing.length

  // Las posiciones llegan por Realtime, la misma tubería del pedido
  // colaborativo. No hay que refrescar para ver moverse el punto.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('delivery-positions')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'delivery_positions' },
        (payload) => {
          const row = payload.new as {
            profile_id: string
            lat: number
            lng: number
            recorded_at: string
          }
          setLive((prev) => {
            const others = prev.filter((c) => c.profileId !== row.profile_id)
            const existing = prev.find((c) => c.profileId === row.profile_id)
            return [
              ...others,
              {
                profileId: row.profile_id,
                name: existing?.name ?? 'Reparto',
                lat: row.lat,
                lng: row.lng,
                recordedAt: row.recorded_at,
              },
            ]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  function handlePick(lat: number, lng: number) {
    if (!placing) return
    const stop = placing
    setPlacing(null)

    startTransition(async () => {
      const form = new FormData()
      form.set('customerId', stop.customerId)
      form.set('lat', String(lat))
      form.set('lng', String(lng))

      const result = await setCustomerLocationAction(initial, form)
      if (result.error) toast.error(result.error)
      else {
        toast.success(`${stop.name} quedó ubicado.`)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
        <span className="text-sm">
          <strong>{located}</strong> de {stops.length} entregas ubicadas
        </span>

        {isCourier && <LiveToggle runId={runId} />}

        {placing && (
          <span className="ml-auto text-sm font-medium text-primary">
            Haz clic en el mapa donde queda {placing.name} ·{' '}
            <button
              type="button"
              className="underline"
              onClick={() => setPlacing(null)}
            >
              cancelar
            </button>
          </span>
        )}
      </div>

      <LeafletMap
        stops={stops}
        couriers={live}
        placing={placing !== null}
        onPick={handlePick}
      />

      {canEdit && missing.length > 0 && (
        <div className="rounded-lg border bg-background p-4">
          <p className="text-sm font-medium">
            {missing.length} entrega{missing.length === 1 ? '' : 's'} sin ubicar
          </p>
          <p className="mb-3 text-sm text-muted-foreground">
            Las direcciones no se pueden convertir en coordenadas
            automáticamente — «Parex», «Edificio», «Debajo de la casa» no le
            dicen nada a un geocodificador, y un pin inventado es peor que
            ninguno. Se marcan una vez y quedan para siempre.
          </p>
          <div className="flex flex-wrap gap-2">
            {missing.map((stop) => (
              <Button
                key={stop.orderId}
                type="button"
                size="sm"
                variant={placing?.customerId === stop.customerId ? 'default' : 'outline'}
                onClick={() => setPlacing(stop)}
              >
                {stop.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Transmitir la posición.
 *
 * Se apaga por defecto y se prende a mano: el GPS gasta batería, y quien
 * reparte tiene que poder decidir cuándo lo comparte.
 */
function LiveToggle({ runId }: { runId: string | null }) {
  const [on, setOn] = useState(false)

  // Si el dispositivo no tiene GPS se avisa AL PRENDER, no dentro del efecto:
  // apagar el interruptor desde un efecto es un render en cascada.
  function toggle() {
    if (!on && !('geolocation' in navigator)) {
      toast.error('Este dispositivo no comparte ubicación.')
      return
    }
    setOn((v) => !v)
  }

  useEffect(() => {
    if (!on) return

    let last = 0
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        // El GPS reporta varias veces por segundo; solo se guarda cada tanto.
        const now = Date.now()
        if (now - last < REPORT_EVERY_MS) return
        last = now

        void reportPositionAction(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
          runId,
        )
      },
      (error) => {
        toast.error(`No pude leer la ubicación: ${error.message}`)
        setOn(false)
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    )

    return () => navigator.geolocation.clearWatch(watch)
  }, [on, runId])

  return (
    <Button
      type="button"
      size="sm"
      variant={on ? 'default' : 'outline'}
      onClick={toggle}
    >
      {on ? 'Transmitiendo ubicación' : 'Transmitir mi ubicación'}
    </Button>
  )
}
