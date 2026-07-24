/**
 * Puerta de entrada del módulo para componentes cliente.
 *
 * `index.ts` también expone las queries (dependen de `next/headers` vía
 * `@/lib/supabase/server`); importarlo desde `"use client"` rompe el build.
 * Aquí solo salen server actions, helpers puros y tipos.
 */

export { markDelivered, undoDelivered } from "./actions";
export { routeToCsv } from "./csv";
export type { ActionResult, DeliveryRunSummary, RouteItem, RouteStop, RunStatus, OrderStatus } from "./types";
