import type { RouteStop } from "./types";

/** Envuelve en comillas solo si hace falta — concatenar strings, sin librería. */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/**
 * CSV de la ruta del día: una fila por parada, productos resumidos en una
 * columna. Pensado para abrir en Excel/Sheets e imprimir o repartir, no para
 * reimportarse — por eso no hace falta una librería como SheetJS.
 */
export function routeToCsv(stops: RouteStop[]): string {
  const header = ["Cliente", "Dirección", "Teléfono", "Productos", "Total", "Nota"];

  const rows = stops.map((stop) => {
    const products = stop.items
      .map((item) => `${item.quantity} ${item.unit} ${item.productName}`)
      .join(" · ");

    return [
      stop.customerName,
      stop.address ?? "",
      stop.phone ?? "",
      products,
      String(stop.totalCop),
      stop.note ?? "",
    ]
      .map(csvField)
      .join(",");
  });

  // BOM UTF-8: sin esto Excel abre las tildes rotas.
  return "\uFEFF" + [header.join(","), ...rows].join("\n");
}
