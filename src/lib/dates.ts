/**
 * Fechas del negocio. Todas las fechas de entrega, pago y corte son fechas
 * calendario (`date` en Postgres, `'YYYY-MM-DD'` en TypeScript) — no instantes.
 *
 * Por eso nunca se construye un `Date` a partir de un string ISO corto: en
 * Bogotá (UTC-5) `new Date('2026-07-20')` se interpreta como UTC y al
 * formatearlo local retrocede al día 19. Un pedido del lunes que se muestra
 * como domingo es un bug silencioso, así que se parsea componente por componente.
 */

/** Fecha calendario en formato ISO corto: `'2026-07-20'`. */
export type IsoDate = string;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

/** Interpreta `'YYYY-MM-DD'` como medianoche **local**, sin corrimiento de zona. */
export function parseIsoDate(iso: IsoDate): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function today(): IsoDate {
  return toIsoDate(new Date());
}

/**
 * Próximo lunes — la **sugerencia** para el date picker del pedido semanal, no
 * una regla. Se entrega los lunes, y el martes cuando el lunes es festivo; los
 * festivos no se calculan a propósito (ver ARCHITECTURE.md §6): quien arma el
 * pedido sabe cuándo hay festivo, y un cálculo que se equivoca en silencio
 * cuesta más que dos clics al mes.
 *
 * Si hoy es lunes, sugiere el lunes siguiente: el pedido de hoy ya se armó.
 */
export function nextMonday(from: Date = new Date()): IsoDate {
  const date = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const daysAhead = ((8 - date.getDay()) % 7) || 7;
  date.setDate(date.getDate() + daysAhead);
  return toIsoDate(date);
}

/** Lunes de la semana que contiene `iso`. Sirve para agrupar producción semanal. */
export function weekStart(iso: IsoDate = today()): IsoDate {
  const date = parseIsoDate(iso);
  const offset = (date.getDay() + 6) % 7; // lunes = 0
  date.setDate(date.getDate() - offset);
  return toIsoDate(date);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Días calendario entre dos fechas. Positivo si `to` es posterior a `from`. */
export function daysBetween(from: IsoDate, to: IsoDate = today()): number {
  const ms = parseIsoDate(to).getTime() - parseIsoDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** `'2026-07-20'` → `'20 de julio de 2026'` */
export function formatLongDate(iso: IsoDate): string {
  const date = parseIsoDate(iso);
  return `${date.getDate()} de ${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

/** `'2026-07-20'` → `'lunes 20 de julio'` — encabezado de la ruta del día. */
export function formatWeekdayDate(iso: IsoDate): string {
  const date = parseIsoDate(iso);
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

/** `'2026-07-20'` → `'20/07/2026'` — tablas densas. */
export function formatShortDate(iso: IsoDate): string {
  const date = parseIsoDate(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** `45` → `'hace 45 días'`; `0` → `'hoy'`. Para la antigüedad de la deuda. */
export function formatAge(days: number): string {
  if (days <= 0) return "hoy";
  if (days === 1) return "hace 1 día";
  return `hace ${days} días`;
}
