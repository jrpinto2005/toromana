'use client'


import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const THEME_KEY = 'toromana:tema'

/**
 * Guion que corre ANTES de pintar.
 *
 * Va en el `<head>` como script suelto y no como efecto de React: un efecto
 * corre después del primer pintado, y el usuario vería la pantalla clara un
 * instante antes de volverse oscura. Ese parpadeo blanco a las seis de la
 * mañana, cuando se arma el pedido, es exactamente lo que hay que evitar.
 */
export const themeScript = `(function(){try{
  var elegido = localStorage.getItem(${JSON.stringify(THEME_KEY)});
  var oscuro = elegido
    ? elegido === 'oscuro'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', oscuro);
  document.documentElement.style.colorScheme = oscuro ? 'dark' : 'light';
}catch(e){}})();`

/**
 * El interruptor no lleva estado de React.
 *
 * Cuál tema está activo ya lo sabe el CSS: la clase `dark` está en el `<html>`
 * desde antes de pintar. Duplicar ese dato en un `useState` obligaría a leerlo
 * en un efecto —que corre después del primer render— y a pintar el icono
 * equivocado por un instante. Se dibujan los dos iconos y CSS esconde el que
 * no toca; siempre correcto, y sin desajuste de hidratación.
 */
export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    document.documentElement.style.colorScheme = next ? 'dark' : 'light'
    localStorage.setItem(THEME_KEY, next ? 'oscuro' : 'claro')
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label="Cambiar entre modo claro y oscuro"
      title="Cambiar tema"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  )
}
