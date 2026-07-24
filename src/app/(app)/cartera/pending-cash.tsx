"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCop } from "@/lib/money";
import { formatShortDate } from "@/lib/dates";
import { confirmPayment, type Payment } from "@/modules/payments";

type Row = Payment & { customerName: string };

/**
 * Efectivo que reparto reportó y todavía no cuadra con caja.
 *
 * Mientras esté aquí, el saldo del cliente sigue en pie: `v_customer_balance`
 * solo suma pagos confirmados. Es a propósito — reparto reporta, contabilidad
 * confirma.
 */
export function PendingCash({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) return null;

  const total = rows.reduce((sum, row) => sum + row.amountCop, 0);

  function confirm(row: Row) {
    startTransition(async () => {
      const result = await confirmPayment(row.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Confirmado: ${formatCop(row.amountCop)} de ${row.customerName}.`);
    });
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="text-amber-900">
          Efectivo por confirmar · {formatCop(total)}
        </CardTitle>
        <p className="text-sm text-amber-800">
          Reparto reportó estos pagos. No bajan el saldo del cliente hasta que se
          confirmen contra caja.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-200 bg-background px-3 py-2"
          >
            <span className="font-medium">{row.customerName}</span>
            <span className="font-mono tabular-nums">{formatCop(row.amountCop)}</span>
            <span className="text-sm text-muted-foreground">
              {formatShortDate(row.paidAt)}
              {row.reportedByName ? ` · reportó ${row.reportedByName}` : ""}
            </span>
            {row.note && (
              <span className="text-xs text-muted-foreground">“{row.note}”</span>
            )}
            <Button
              size="sm"
              className="ml-auto"
              disabled={pending}
              onClick={() => confirm(row)}
            >
              <Check />
              Confirmar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
