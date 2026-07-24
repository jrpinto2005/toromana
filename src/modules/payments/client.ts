/**
 * Puerta de entrada del módulo para componentes cliente.
 *
 * `index.ts` expone también las queries, y esas dependen de `next/headers`:
 * importarlo desde un `"use client"` mete código de servidor en el bundle del
 * navegador y rompe el build. Aquí solo salen server actions y tipos —lo único
 * que la UI necesita del lado del cliente.
 */

export {
  registerPayment,
  reportCashFromRoute,
  confirmPayment,
  deletePayment,
} from "./actions";

export type {
  ActionResult,
  Receivable,
  Payment,
  PaymentMethod,
  PaymentStatus,
  LedgerEntry,
  CustomerStatement,
  RegisterPaymentInput,
} from "./types";
