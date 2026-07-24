/** API pública del módulo `payments`. Nadie afuera importa sus archivos internos. */

export {
  listReceivables,
  listPendingCashPayments,
  listCustomerPayments,
  getCustomerStatement,
  getCompanySettings,
  summarizeReceivables,
} from "./queries";

export {
  registerPayment,
  reportCashFromRoute,
  confirmPayment,
  deletePayment,
  listPaymentHandlers,
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
