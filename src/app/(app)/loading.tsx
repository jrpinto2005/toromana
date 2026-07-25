import { Skeleton } from '@/components/ui/skeleton'

/**
 * Lo que se ve mientras el servidor responde.
 *
 * Sin esto, tocar una pestaña no producía ningún cambio visible hasta que
 * llegaban los datos — en un celular con señal regular eso son dos segundos en
 * los que la app parece congelada y uno vuelve a tocar. El esqueleto no acelera
 * nada, pero convierte una espera muda en una respuesta.
 *
 * Cubre todas las rutas de la aplicación: Next usa el `loading.tsx` más cercano,
 * y ninguna pantalla necesita hoy uno propio.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy aria-label="Cargando">
      <div className="space-y-2">
        <Skeleton className="h-7 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg border bg-background p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="divide-y rounded-lg border bg-background">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-64 max-w-full" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
