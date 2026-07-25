import type { IsoDate } from "@/lib/dates";
import type { UrgencyLevel } from "@/modules/notifications";

export type PaymentMethod = "efectivo" | "transferencia";
export type PaymentStatus = "confirmado" | "por_confirmar";

/**
 * Una fila del panel de cobros: la deuda de un cliente con lo mínimo para
 * decidir a quién llamar hoy.
 *
 * `balanceCop`, `oldestUnpaidDate` y `daysOverdue` vienen de `v_customer_debt`.
 * `urgency` se calcula en TypeScript sobre esos datos.
 */
export type Receivable = {
  customerId: string;
  customerName: string;
  phone: string | null;
  /** Decide a qué cuenta bancaria se le pide que pague. */
  isInstitutional: boolean;
  sellerId: string | null;
  sellerName: string | null;
  chargedCop: number;
  paidCop: number;
  balanceCop: number;
  oldestUnpaidDate: IsoDate | null;
  daysOverdue: number;
  urgencyLevel: UrgencyLevel;
};

export type Payment = {
  id: string;
  customerId: string;
  amountCop: number;
  method: PaymentMethod;
  paidAt: IsoDate;
  status: PaymentStatus;
  receivedById: string | null;
  receivedByName: string | null;
  /** Quién tiene el comprobante. Solo aplica a transferencias. */
  receiptHolderId: string | null;
  receiptHolderName: string | null;
  reportedById: string | null;
  reportedByName: string | null;
  confirmedById: string | null;
  note: string | null;
  createdAt: string;
};

/** Un movimiento del estado de cuenta: cargo (pedido) o abono (pago). */
export type LedgerEntry = {
  kind: "cargo" | "abono";
  date: IsoDate;
  amountCop: number;
  detail: string;
  /** Los pagos `por_confirmar` no afectan el saldo hasta que contabilidad los confirme. */
  pending: boolean;
};

export type CustomerStatement = {
  customerId: string;
  chargedCop: number;
  paidCop: number;
  balanceCop: number;
  oldestUnpaidDate: IsoDate | null;
  daysOverdue: number;
  entries: LedgerEntry[];
  /** Efectivo reportado por reparto que aún no entra al saldo. */
  pendingCashCop: number;
};

/**
 * Resultado de una acción de escritura. Se devuelve el error en vez de lanzarlo
 * porque quien lo consume es un formulario, no un log: el usuario tiene que leer
 * qué pasó sin que la pantalla se caiga.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

export type RegisterPaymentInput = {
  customerId: string;
  amountCop: number;
  method: PaymentMethod;
  paidAt: IsoDate;
  /** Solo transferencias. Se ignora en efectivo — la base lo rechaza. */
  receiptHolderId?: string | null;
  note?: string | null;
};
