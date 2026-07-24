/**
 * Módulo de documentos — API pública.
 *
 * Los demás módulos importan SOLO desde aquí, nunca de queries.ts o actions.ts
 * directamente.
 */

export type {
  ActionResult,
  DeliveryRunSummary,
  Receipt,
  ReceiptItem,
  RouteItem,
  RouteStop,
  RunStatus,
  OrderStatus,
} from "./types";

export { getActiveRun, getRun, getRouteStops, getReceipt } from "./queries";
export { markDelivered, undoDelivered, generatePurchaseOrdersForRun } from "./actions";
export { routeToCsv } from "./csv";
