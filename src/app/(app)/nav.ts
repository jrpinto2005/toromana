import type { UserRole } from '@/lib/auth'

export type NavItem = {
  href: string
  label: string
  roles: UserRole[]
}

/**
 * Navegación completa de la aplicación, definida de entrada.
 *
 * Incluye rutas que todavía no existen: se van llenando a medida que avanza el
 * desarrollo. Está centralizada aquí para que agregar una pantalla no obligue a
 * dos personas a editar el mismo layout al tiempo.
 */
export const NAV: NavItem[] = [
  {
    href: '/pedidos',
    label: 'Pedidos',
    roles: ['admin', 'contabilidad', 'produccion'],
  },
  {
    href: '/clientes',
    label: 'Clientes',
    roles: ['admin', 'contabilidad', 'produccion'],
  },
  {
    href: '/cartera',
    label: 'Cartera',
    roles: ['admin', 'contabilidad', 'produccion'],
  },
  {
    href: '/ruta',
    label: 'Ruta',
    roles: ['admin', 'reparto'],
  },
  {
    href: '/produccion',
    label: 'Producción',
    roles: ['admin', 'produccion'],
  },
  {
    href: '/analitica',
    label: 'Analítica',
    roles: ['admin'],
  },
  {
    href: '/ajustes',
    label: 'Ajustes',
    roles: ['admin'],
  },
]

export function navFor(role: UserRole): NavItem[] {
  return NAV.filter((item) => item.roles.includes(role))
}

/** A dónde cae cada rol al entrar. Reparto solo necesita su ruta del día. */
export function homeFor(role: UserRole): string {
  return role === 'reparto' ? '/ruta' : '/pedidos'
}
