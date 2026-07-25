'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { NavItem } from './nav'

export function NavLinks({
  items,
  badges = {},
}: {
  items: NavItem[]
  /** Cuántas cosas esperan en cada sección. Cero no se muestra. */
  badges?: Record<string, number>
}) {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1 overflow-x-auto">
      {items.map((item) => {
        const active = pathname.startsWith(item.href)
        const badge = badges[item.href] ?? 0

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {item.label}
            {badge > 0 && (
              <span
                className="rounded-full bg-amber-500/15 px-1.5 text-xs font-semibold tabular-nums text-amber-700 dark:text-amber-400"
                title={`${badge} sin resolver`}
              >
                {badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
