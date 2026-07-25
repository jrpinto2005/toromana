import { createClient } from "@/lib/supabase/server";
import type { IsoDate } from "@/lib/dates";
import { urgencyFor } from "@/modules/notifications";
import { formatCop } from "@/lib/money";
import type {
  CustomerStatement,
  LedgerEntry,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Receivable,
} from "./types";

type ProfileRef = { id: string; full_name: string } | null;

/** Supabase devuelve las relaciones anidadas como objeto o arreglo según el join. */
function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Deudas de todos los clientes con saldo, de la más urgente a la menos.
 *
 * Los saldos salen de `v_customer_debt` — nunca se recalculan aquí. Lo único que
 * agrega TypeScript es el nivel de urgencia, que es regla de negocio.
 *
 * `opts.sellerId` filtra por vendedor: cada vendedor cobra lo suyo, admin y
 * contabilidad ven todo.
 */
export async function listReceivables(opts?: {
  sellerId?: string;
  includeSettled?: boolean;
}): Promise<Receivable[]> {
  const supabase = await createClient();

  const { data: debts, error } = await supabase
    .from("v_customer_debt")
    .select(
      "customer_id, charged_cop, paid_cop, balance_cop, oldest_unpaid_date, days_overdue",
    );
  if (error) throw new Error(`No se pudo leer la cartera: ${error.message}`);
  if (!debts?.length) return [];

  let customerQuery = supabase
    .from("customers")
    .select(
      "id, name, phone, kind, seller_id, seller:profiles!customers_seller_id_fkey(id, full_name)",
    )
    .eq("active", true);
  if (opts?.sellerId) customerQuery = customerQuery.eq("seller_id", opts.sellerId);

  const { data: customers, error: customersError } = await customerQuery;
  if (customersError) {
    throw new Error(`No se pudo leer los clientes: ${customersError.message}`);
  }

  const byCustomer = new Map(debts.map((d) => [d.customer_id as string, d]));

  const rows: Receivable[] = (customers ?? []).flatMap((customer) => {
    const debt = byCustomer.get(customer.id);
    if (!debt) return [];

    const balanceCop = debt.balance_cop ?? 0;
    if (!opts?.includeSettled && balanceCop <= 0) return [];

    const daysOverdue = debt.days_overdue ?? 0;
    const seller = one(customer.seller as ProfileRef | ProfileRef[]);

    return [
      {
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        isInstitutional: customer.kind === "institucional",
        sellerId: customer.seller_id,
        sellerName: seller?.full_name ?? null,
        chargedCop: debt.charged_cop ?? 0,
        paidCop: debt.paid_cop ?? 0,
        balanceCop,
        oldestUnpaidDate: debt.oldest_unpaid_date,
        daysOverdue,
        urgencyLevel: urgencyFor(balanceCop, daysOverdue).level,
      },
    ];
  });

  // Más urgente primero; dentro del mismo nivel, la deuda más vieja arriba y
  // luego el monto mayor: es el orden en que conviene hacer las llamadas.
  return rows.sort((a, b) => {
    const rankDiff =
      urgencyFor(b.balanceCop, b.daysOverdue).rank -
      urgencyFor(a.balanceCop, a.daysOverdue).rank;
    if (rankDiff !== 0) return rankDiff;
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.balanceCop - a.balanceCop;
  });
}

const PAYMENT_COLUMNS = `
  id, customer_id, amount_cop, method, paid_at, status, note, created_at,
  received_by, reported_by, confirmed_by, receipt_holder,
  received:profiles!payments_received_by_fkey(id, full_name),
  reporter:profiles!payments_reported_by_fkey(id, full_name),
  holder:profiles!payments_receipt_holder_fkey(id, full_name)
`;

type PaymentRow = {
  id: string;
  customer_id: string;
  amount_cop: number;
  method: PaymentMethod;
  paid_at: IsoDate;
  status: PaymentStatus;
  note: string | null;
  created_at: string;
  received_by: string | null;
  reported_by: string | null;
  confirmed_by: string | null;
  receipt_holder: string | null;
  received: ProfileRef | ProfileRef[];
  reporter: ProfileRef | ProfileRef[];
  holder: ProfileRef | ProfileRef[];
};

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    customerId: row.customer_id,
    amountCop: row.amount_cop,
    method: row.method,
    paidAt: row.paid_at,
    status: row.status,
    receivedById: row.received_by,
    receivedByName: one(row.received)?.full_name ?? null,
    receiptHolderId: row.receipt_holder,
    receiptHolderName: one(row.holder)?.full_name ?? null,
    reportedById: row.reported_by,
    reportedByName: one(row.reporter)?.full_name ?? null,
    confirmedById: row.confirmed_by,
    note: row.note,
    createdAt: row.created_at,
  };
}

/**
 * Bandeja de efectivo por confirmar: lo que reparto reportó y contabilidad
 * todavía no ha validado. Estos pagos no bajan el saldo del cliente.
 */
export async function listPendingCashPayments(): Promise<
  (Payment & { customerName: string })[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select(`${PAYMENT_COLUMNS}, customer:customers(name)`)
    .eq("status", "por_confirmar")
    .order("paid_at", { ascending: true });

  if (error) throw new Error(`No se pudo leer los pagos pendientes: ${error.message}`);

  return (data ?? []).map((row) => {
    const customer = one(row.customer as { name: string } | { name: string }[]);
    return {
      ...toPayment(row as unknown as PaymentRow),
      customerName: customer?.name ?? "—",
    };
  });
}

export async function listCustomerPayments(customerId: string): Promise<Payment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("customer_id", customerId)
    .order("paid_at", { ascending: false });

  if (error) throw new Error(`No se pudo leer los pagos: ${error.message}`);
  return (data ?? []).map((row) => toPayment(row as unknown as PaymentRow));
}

/**
 * Estado de cuenta: cargos y abonos en orden cronológico, con los totales que
 * ya calculó la vista. Es lo que se le muestra al cliente cuando pregunta
 * "¿por qué debo esto?".
 */
export async function getCustomerStatement(
  customerId: string,
): Promise<CustomerStatement | null> {
  const supabase = await createClient();

  const [debtResult, chargesResult, paymentsResult] = await Promise.all([
    supabase
      .from("v_customer_debt")
      .select("charged_cop, paid_cop, balance_cop, oldest_unpaid_date, days_overdue")
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase
      .from("v_charges")
      .select("charge_date, amount")
      .eq("customer_id", customerId)
      .order("charge_date", { ascending: true }),
    supabase
      .from("payments")
      .select(PAYMENT_COLUMNS)
      .eq("customer_id", customerId)
      .order("paid_at", { ascending: true }),
  ]);

  if (debtResult.error) {
    throw new Error(`No se pudo leer el saldo: ${debtResult.error.message}`);
  }
  if (!debtResult.data) return null;

  const charges: LedgerEntry[] = (chargesResult.data ?? []).map((row) => ({
    kind: "cargo",
    date: row.charge_date as IsoDate,
    amountCop: row.amount as number,
    detail: "Entrega",
    pending: false,
  }));

  const payments = (paymentsResult.data ?? []).map((row) =>
    toPayment(row as unknown as PaymentRow),
  );

  const abonos: LedgerEntry[] = payments.map((payment) => ({
    kind: "abono",
    date: payment.paidAt,
    amountCop: payment.amountCop,
    detail:
      payment.method === "efectivo"
        ? `Efectivo${payment.receivedByName ? ` — recibió ${payment.receivedByName}` : ""}`
        : `Transferencia${payment.receiptHolderName ? ` — comprobante con ${payment.receiptHolderName}` : ""}`,
    pending: payment.status === "por_confirmar",
  }));

  const entries = [...charges, ...abonos].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind === "cargo" ? -1 : 1,
  );

  const pendingCashCop = payments
    .filter((p) => p.status === "por_confirmar")
    .reduce((sum, p) => sum + p.amountCop, 0);

  return {
    customerId,
    chargedCop: debtResult.data.charged_cop ?? 0,
    paidCop: debtResult.data.paid_cop ?? 0,
    balanceCop: debtResult.data.balance_cop ?? 0,
    oldestUnpaidDate: debtResult.data.oldest_unpaid_date,
    daysOverdue: debtResult.data.days_overdue ?? 0,
    entries,
    pendingCashCop,
  };
}

/** Datos de la empresa. La cuenta bancaria se cita en los mensajes de cobro. */
export async function getCompanySettings(): Promise<{
  brandName: string;
  legalName: string;
  taxId: string;
  contactBlock: string;
  bankDetails: string;
  /** Cuenta para institucionales: giran contra factura, a otra cuenta. */
  bankDetailsInstitutional: string;
}> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("company_settings")
    .select(
      "brand_name, legal_name, tax_id, contact_block, bank_details, bank_details_institutional",
    )
    .maybeSingle();

  return {
    brandName: data?.brand_name ?? "",
    legalName: data?.legal_name ?? "",
    taxId: data?.tax_id ?? "",
    contactBlock: data?.contact_block ?? "",
    bankDetails: data?.bank_details ?? "",
    bankDetailsInstitutional:
      data?.bank_details_institutional || data?.bank_details || "",
  };
}

/** Totales del encabezado del panel. Se derivan de las mismas filas. */
export function summarizeReceivables(rows: Receivable[]) {
  const totalCop = rows.reduce((sum, r) => sum + r.balanceCop, 0);
  const criticalCop = rows
    .filter((r) => r.urgencyLevel === "critico" || r.urgencyLevel === "urgente")
    .reduce((sum, r) => sum + r.balanceCop, 0);

  return {
    customers: rows.length,
    totalCop,
    totalLabel: formatCop(totalCop),
    criticalCop,
    criticalLabel: formatCop(criticalCop),
  };
}
