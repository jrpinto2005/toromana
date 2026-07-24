/**
 * Nivel de urgencia de una deuda.
 *
 * Vive en TypeScript y no en SQL a propósito: los umbrales son una regla de
 * negocio y van a cambiar el día que el negocio decida que 30 días ya es grave.
 * Cambiar un arreglo aquí es más barato que una migración.
 */

export type UrgencyLevel = "al_dia" | "reciente" | "atencion" | "urgente" | "critico";

export type Urgency = {
  level: UrgencyLevel;
  label: string;
  emoji: string;
  /** 0 = al día. Ordena el panel de cobros de mayor a menor. */
  rank: number;
  /** Clases de Tailwind para el chip. Un color, no una decisión de layout. */
  badgeClass: string;
};

const URGENCIES: Record<UrgencyLevel, Urgency> = {
  al_dia: {
    level: "al_dia",
    label: "Al día",
    emoji: "🟢",
    rank: 0,
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  reciente: {
    level: "reciente",
    label: "Reciente",
    emoji: "🟡",
    rank: 1,
    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-200",
  },
  atencion: {
    level: "atencion",
    label: "Atención",
    emoji: "🟠",
    rank: 2,
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
  },
  urgente: {
    level: "urgente",
    label: "Urgente",
    emoji: "🔴",
    rank: 3,
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
  critico: {
    level: "critico",
    label: "Crítico",
    emoji: "⚫",
    rank: 4,
    badgeClass: "bg-neutral-800 text-neutral-50 border-neutral-800",
  },
};

/** Umbral superior de días de cada nivel. `Infinity` cierra la escala. */
const THRESHOLDS: Array<{ maxDays: number; level: UrgencyLevel }> = [
  { maxDays: 30, level: "reciente" },
  { maxDays: 60, level: "atencion" },
  { maxDays: 90, level: "urgente" },
  { maxDays: Infinity, level: "critico" },
];

/**
 * Sin saldo es "al día" incluso con deuda vieja saldada: `days_overdue` ya llega
 * en 0 desde la vista cuando `balance_cop <= 0`, pero un cliente puede tener
 * saldo a favor (`balance_cop` negativo) y eso tampoco es urgente.
 */
export function urgencyFor(balanceCop: number, daysOverdue: number): Urgency {
  if (balanceCop <= 0) return URGENCIES.al_dia;
  const match = THRESHOLDS.find((t) => daysOverdue <= t.maxDays);
  return URGENCIES[match ? match.level : "critico"];
}

export function urgencyByLevel(level: UrgencyLevel): Urgency {
  return URGENCIES[level];
}

export const ALL_URGENCIES: Urgency[] = Object.values(URGENCIES);

/** Niveles con deuda, del más grave al más leve. Para los filtros del panel. */
export const OVERDUE_URGENCIES: Urgency[] = ALL_URGENCIES.filter(
  (u) => u.level !== "al_dia",
).sort((a, b) => b.rank - a.rank);
