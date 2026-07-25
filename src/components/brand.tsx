import { cn } from '@/lib/utils'

/**
 * La marca: un huevo y una mora, que es literalmente lo que vende el negocio.
 *
 * Va como SVG en línea y no como imagen. El logo original viene sobre un fondo
 * crema, y pegado en una barra oscura se ve como una estampilla; dibujado toma
 * el color del texto y funciona igual en claro, en oscuro y al imprimir.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 34 30"
      fill="none"
      aria-hidden
      className={cn('size-7 shrink-0', className)}
    >
      {/* Huevo: solo contorno, como en el logo */}
      <path
        d="M11.6 2.6C7.2 6.9 4.9 12 4.9 16.1c0 5.1 3.1 8.8 7.3 8.8s7.3-3.7 7.3-8.8c0-4.1-2.3-9.2-6.7-13.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Brillo del cascarón */}
      <path
        d="M9.3 8.8c-1 1.6-1.7 3.2-2 4.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".55"
      />
      {/* Mora */}
      <g fill="currentColor">
        <circle cx="24.4" cy="15.6" r="2.15" />
        <circle cx="28.5" cy="17.1" r="2.15" />
        <circle cx="20.5" cy="17.4" r="2.15" />
        <circle cx="26.5" cy="19.6" r="2.15" />
        <circle cx="22.4" cy="20.2" r="2.15" />
        <circle cx="24.5" cy="23.3" r="2.15" />
      </g>
      {/* Hoja y tallo */}
      <path
        d="M25.8 11.8c1.5-1.9 3.8-2.5 5.3-2.3-.2 1.7-1.3 3.7-3.4 4.2-.9.2-1.7 0-1.9-1.9z"
        fill="currentColor"
      />
      <path
        d="M24.6 13.4c0-1.5.3-2.8.9-3.8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Marca completa: el dibujo en verde salvia y el nombre en la tinta del texto.
 *
 * El verde solo lo lleva el símbolo. Repintar también el nombre haría que la
 * marca compitiera con el contenido, y en una herramienta de trabajo lo que
 * tiene que resaltar son los datos.
 */
export function Brand({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'md' | 'lg'
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandMark
        className={cn(
          'text-[#757460] dark:text-[#a3a189]',
          size === 'lg' ? 'size-10' : 'size-7',
        )}
      />
      <span
        className={cn(
          'font-semibold tracking-tight',
          size === 'lg' ? 'text-3xl' : 'text-lg',
        )}
      >
        Toromana
      </span>
    </span>
  )
}
