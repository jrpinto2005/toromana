'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Courier, MapStop } from './route-map'

/** Bogotá, para cuando todavía no hay ni un punto marcado. */
const DEFAULT_CENTER: [number, number] = [4.65, -74.06]

/**
 * El mapa en Leaflet puro.
 *
 * Se maneja por referencia y no con `react-leaflet` para las capas: los pines
 * cambian en cada tick de posición, y recrear el árbol de React con cada
 * actualización hacía parpadear el mapa entero. Aquí solo se mueven las capas
 * que cambiaron.
 *
 * Los iconos son `divIcon` con HTML y no las imágenes que trae Leaflet: sus
 * rutas se rompen al empaquetar, y de paso esto permite pintar el número de
 * parada y el estado de la entrega dentro del pin.
 */
export function LeafletMap({
  stops,
  couriers,
  placing,
  onPick,
}: {
  stops: MapStop[]
  couriers: Courier[]
  placing: boolean
  onPick: (lat: number, lng: number) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const stopLayer = useRef<L.LayerGroup | null>(null)
  const courierLayer = useRef<L.LayerGroup | null>(null)
  const pick = useRef(onPick)

  // El manejador de clic se registra una sola vez en Leaflet, así que la
  // función se guarda en una ref para que siempre llame a la versión actual.
  // Escribirla en un efecto y no durante el render: el render debe ser puro.
  useEffect(() => {
    pick.current = onPick
  }, [onPick])

  useEffect(() => {
    if (!container.current || map.current) return

    const instance = L.map(container.current, {
      center: DEFAULT_CENTER,
      zoom: 12,
      zoomControl: true,
    })

    // OpenStreetMap: sin llave, sin cuenta, sin costo. La atribución es
    // obligatoria por su licencia, no decorativa.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(instance)

    stopLayer.current = L.layerGroup().addTo(instance)
    courierLayer.current = L.layerGroup().addTo(instance)
    map.current = instance

    instance.on('click', (e: L.LeafletMouseEvent) => {
      pick.current(e.latlng.lat, e.latlng.lng)
    })

    return () => {
      instance.remove()
      map.current = null
    }
  }, [])

  // ── Paradas ──
  useEffect(() => {
    const layer = stopLayer.current
    if (!layer || !map.current) return

    layer.clearLayers()
    const located = stops.filter((s) => s.lat !== null && s.lng !== null)

    for (const stop of located) {
      const color = stop.delivered ? '#1baf7a' : '#2a78d6'
      const marker = L.marker([stop.lat!, stop.lng!], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background:${color};color:#fff;width:26px;height:26px;
            border-radius:50%;display:flex;align-items:center;justify-content:center;
            font:600 12px/1 system-ui,sans-serif;
            box-shadow:0 0 0 2px #fff,0 1px 4px rgba(0,0,0,.35)">${stop.position}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
      })

      marker.bindPopup(
        `<strong>${escapeHtml(stop.name)}</strong><br>` +
          `${escapeHtml(stop.address ?? 'Sin dirección')}<br>` +
          `<em>${stop.delivered ? 'Entregado' : 'Pendiente'}</em>`,
      )
      marker.addTo(layer)
    }

    if (located.length > 0) {
      map.current.fitBounds(
        L.latLngBounds(located.map((s) => [s.lat!, s.lng!] as [number, number])),
        { padding: [40, 40], maxZoom: 15 },
      )
    }
  }, [stops])

  // ── Quien reparte, en vivo ──
  useEffect(() => {
    const layer = courierLayer.current
    if (!layer) return

    layer.clearLayers()
    for (const courier of couriers) {
      L.marker([courier.lat, courier.lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background:#eb6834;width:18px;height:18px;border-radius:50%;
            box-shadow:0 0 0 3px #fff,0 0 0 8px rgba(235,104,52,.28)"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        zIndexOffset: 1000,
      })
        .bindPopup(`<strong>${escapeHtml(courier.name)}</strong><br>en ruta`)
        .addTo(layer)
    }
  }, [couriers])

  // El cursor avisa que el mapa está esperando un clic para marcar.
  useEffect(() => {
    if (container.current) {
      container.current.style.cursor = placing ? 'crosshair' : ''
    }
  }, [placing])

  return <div ref={container} className="h-[28rem] w-full rounded-lg border" />
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )
}
