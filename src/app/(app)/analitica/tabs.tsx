import Link from 'next/link'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/analitica', label: 'Producción', key: 'produccion' },
  { href: '/analitica/plan', label: 'Plan y compras', key: 'plan' },
]

export function AnalyticsTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            active === tab.key
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
