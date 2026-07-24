import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  getCompanySettings,
  listPaymentHandlers,
  listPendingCashPayments,
  listReceivables,
  summarizeReceivables,
} from "@/modules/payments";
import { ReceivablesTable } from "./receivables-table";
import { PendingCash } from "./pending-cash";

export const metadata = { title: "Cartera · Toromana" };

export default async function CarteraPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  // Producción vende, pero solo cobra lo suyo. Admin y contabilidad ven todo.
  const onlyMine = profile.role === "produccion";

  const [rows, company, pendingCash, handlers] = await Promise.all([
    listReceivables(onlyMine ? { sellerId: profile.id } : undefined),
    getCompanySettings(),
    profile.role === "admin" || profile.role === "contabilidad"
      ? listPendingCashPayments()
      : Promise.resolve([]),
    listPaymentHandlers(),
  ]);

  const summary = summarizeReceivables(rows);

  const sellers = Array.from(
    new Map(
      rows
        .filter((row) => row.sellerId)
        .map((row) => [row.sellerId!, row.sellerName ?? "Sin nombre"]),
    ),
  ).map(([id, name]) => ({ id, name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cartera</h1>
        <p className="text-sm text-muted-foreground">
          Quién debe, cuánto y desde cuándo. Los saldos se derivan de las entregas y
          los pagos confirmados.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Por cobrar" value={summary.totalLabel} />
        <SummaryCard
          label="Urgente o crítico"
          value={summary.criticalLabel}
          tone="danger"
        />
        <SummaryCard label="Clientes con saldo" value={String(summary.customers)} />
      </div>

      <PendingCash rows={pendingCash} />

      <ReceivablesTable
        rows={rows}
        bankDetails={company.bankDetails}
        brandName={company.brandName}
        sellers={sellers}
        handlers={handlers}
        currentUserId={profile.id}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
        <div
          className={
            tone === "danger"
              ? "mt-1 font-mono text-2xl tabular-nums text-red-700"
              : "mt-1 font-mono text-2xl tabular-nums"
          }
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

export const dynamic = "force-dynamic";
