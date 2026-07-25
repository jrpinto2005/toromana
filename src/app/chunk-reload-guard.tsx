'use client'

import { useEffect } from 'react'

const FLAG = 'toromana:recargado-por-despliegue'

/**
 * Recupera la página cuando el despliegue cambió con la pestaña abierta.
 *
 * Cada build de Vercel publica los archivos estáticos con un hash nuevo y borra
 * los del anterior. Una pestaña que quedó abierta antes del despliegue sigue
 * pidiendo los hashes viejos: al navegar, el CSS de esa ruta responde 404 y la
 * página aparece sin estilos — HTML crudo. Es desconcertante y parece que la
 * aplicación se rompió, cuando basta con recargar.
 *
 * Aquí se detecta ese 404 y se recarga una sola vez. La marca en
 * `sessionStorage` es lo que evita el bucle: si después de recargar el error
 * sigue, ya no es un despliegue viejo y hay que dejar que se vea.
 */
export function ChunkReloadGuard() {
  useEffect(() => {
    function recover(reason: string) {
      if (sessionStorage.getItem(FLAG)) return
      sessionStorage.setItem(FLAG, reason)
      window.location.reload()
    }

    // Un <link> o <script> de /_next/static que no carga.
    function onResourceError(event: Event) {
      const target = event.target as HTMLElement | null
      if (!target) return

      const url =
        (target as HTMLLinkElement).href ?? (target as HTMLScriptElement).src ?? ''
      if (typeof url === 'string' && url.includes('/_next/static')) {
        recover('recurso')
      }
    }

    function onRejection(event: PromiseRejectionEvent) {
      const message = String(event.reason?.name ?? event.reason ?? '')
      if (message.includes('ChunkLoadError')) recover('chunk')
    }

    // En captura: los errores de carga de recursos no burbujean.
    window.addEventListener('error', onResourceError, true)
    window.addEventListener('unhandledrejection', onRejection)

    return () => {
      window.removeEventListener('error', onResourceError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
