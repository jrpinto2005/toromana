import { BrandMark } from '@/components/brand'
import { cn } from '@/lib/utils'

/**
 * Pantalla vacía.
 *
 * Una pantalla en blanco que solo dice "no hay datos" deja a quien la mira sin
 * saber si se rompió algo, si le falta permiso o si simplemente todavía no ha
 * hecho nada. Estas dicen lo tercero, y sobre todo dicen qué va a pasar cuando
 * actúe: un vacío es el mejor momento para explicar cómo funciona la pantalla,
 * porque no hay nada más compitiendo por la atención.
 */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed bg-background px-6 py-12 text-center',
        className,
      )}
    >
      <BrandMark className="size-9 text-[#757460] opacity-35 dark:text-[#a3a189]" />
      <p className="mt-3 font-medium">{title}</p>
      {children && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{children}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
