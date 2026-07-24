/**
 * Pesos colombianos. Enteros, sin decimales, siempre.
 *
 * El negocio no cobra centavos: el precio más bajo de la lista es $4.000. Guardar
 * dinero en `float` para poder representar algo que nunca existe es cambiar
 * exactitud por nada.
 */

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const PLAIN = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

/** `1234500` → `"$ 1.234.500"` */
export function formatCop(amount: number): string {
  return COP.format(Math.round(amount));
}

/** `1234500` → `"1.234.500"` — para tablas donde el `$` va en el encabezado. */
export function formatCopPlain(amount: number): string {
  return PLAIN.format(Math.round(amount));
}

/**
 * Lee un monto tecleado por un humano: `"$ 20.000"`, `"20000"`, `"20.000 COP"`.
 * Devuelve `null` si no hay un número adentro, para que la UI pueda distinguir
 * "vacío" de "cero" en vez de tratar la basura como $0.
 */
export function parseCop(input: string): number | null {
  const digits = input.replace(/[^\d-]/g, "");
  if (digits === "" || digits === "-") return null;
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) ? value : null;
}

/**
 * Cantidades: `numeric(10,2)` en la base. Media cubeta de huevos (`0.5`) es una
 * venta real, no un error de digitación — pero `2.00` se muestra como `2`.
 */
export function formatQuantity(quantity: number): string {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 2,
  }).format(quantity);
}

/** Redondeo al peso de `cantidad × precio`. Igual que la columna generada en SQL. */
export function lineTotalCop(quantity: number, unitPriceCop: number): number {
  return Math.round(quantity * unitPriceCop);
}
