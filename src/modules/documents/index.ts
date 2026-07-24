/**
 * Módulo de documentos — API pública.
 *
 * Los demás módulos importan SOLO desde aquí, nunca de queries.ts o actions.ts
 * directamente.
 */

export type { ActionResult, DeliveryRunSummary, RouteItem, RouteStop, RunStatus, OrderStatus } from "./types";

export { getActiveRun, getRun, getRouteStops } from "./queries";
export { markDelivered, undoDelivered } from "./actions";
export { routeToCsv } from "./csv";

// Contrato que A llama al confirmar el pedido semanal. Placeholder hasta el
// bloque 6 (órdenes de compra); no truena porque nadie lo invoca todavía.
export async function generatePurchaseOrdersForRun(
  _runId: string,
): Promise<{ generated: number }> {
  return { generated: 0 };
}
