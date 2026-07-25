"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCop } from "@/lib/money";
import { formatAge, formatShortDate } from "@/lib/dates";
import {
  bankDetailsFor,
  collectionMessage,
  urgencyFor,
  whatsAppLink,
} from "@/modules/notifications";
import type { CustomerStatement } from "@/modules/payments/client";
import { PaymentForm } from "../payment-form";
import { UrgencyBadge } from "../urgency-badge";

type Props = {
  customer: { id: string; name: string; phone: string | null };
  statement: CustomerStatement;
  handlers: { id: string; fullName: string }[];
  currentUserId: string;
  bankDetails: string;
  bankDetailsInstitutional: string;
  isInstitutional: boolean;
  brandName: string;
};

export function StatementView({
  customer,
  statement,
  handlers,
  currentUserId,
  bankDetails,
  bankDetailsInstitutional,
  isInstitutional,
  brandName,
}: Props) {
  const [formOpen, setFormOpen] = useState(false);

  const urgency = urgencyFor(statement.balanceCop, statement.daysOverdue);
  const link = whatsAppLink(
    customer.phone,
    collectionMessage({
      customerName: customer.name,
      balanceCop: statement.balanceCop,
      oldestUnpaidDate: statement.oldestUnpaidDate,
      daysOverdue: statement.daysOverdue,
      bankDetails: bankDetailsFor(isInstitutional, {
        bankDetails,
        bankDetailsInstitutional,
      }),
      brandName,
    }),
  );

  // El saldo corriente se arma recorriendo los movimientos. Los pagos pendientes
  // no lo mueven, igual que en la vista de la base.
  //
  // Se calcula ANTES de renderizar, no acumulando dentro del map: mutar una
  // variable durante el render funciona por accidente hoy, pero en cuanto React
  // memoiza las filas el acumulado empieza a dar cifras equivocadas. En la
  // pantalla de saldos eso no es un detalle.
  const runningBalances = statement.entries.reduce<number[]>((acc, entry) => {
    const previous = acc.length > 0 ? acc[acc.length - 1] : 0;
    if (entry.kind === "cargo") acc.push(previous + entry.amountCop);
    else if (!entry.pending) acc.push(previous - entry.amountCop);
    else acc.push(previous);
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <UrgencyBadge level={urgency.level} />
            {statement.balanceCop > 0 && statement.oldestUnpaidDate && (
              <span className="text-sm text-muted-foreground">
                pendiente desde {formatShortDate(statement.oldestUnpaidDate)} (
                {formatAge(statement.daysOverdue)})
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {link && (
            <Button
              variant="outline"
              render={<a href={link} target="_blank" rel="noopener noreferrer" />}
            >
              <MessageCircle />
              Cobrar por WhatsApp
            </Button>
          )}

          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger render={<Button>Registrar pago</Button>} />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar pago de {customer.name}</DialogTitle>
              </DialogHeader>
              <PaymentForm
                customerId={customer.id}
                customerName={customer.name}
                balanceCop={statement.balanceCop}
                handlers={handlers}
                currentUserId={currentUserId}
                onDone={() => setFormOpen(false)}
              />
              <DialogFooter>
                <DialogClose render={<Button variant="outline">Cerrar</Button>} />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="Facturado" value={formatCop(statement.chargedCop)} />
        <Figure label="Pagado" value={formatCop(statement.paidCop)} />
        <Figure
          label="Saldo"
          value={formatCop(statement.balanceCop)}
          highlight={statement.balanceCop > 0}
        />
      </div>

      {statement.pendingCashCop > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Hay {formatCop(statement.pendingCashCop)} en efectivo reportado sin confirmar.
          No está descontado del saldo todavía.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Estado de cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead className="text-right">Cargo</TableHead>
                <TableHead className="text-right">Abono</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statement.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Sin movimientos.
                  </TableCell>
                </TableRow>
              )}

              {statement.entries.map((entry, index) => {
                return (
                  <TableRow
                    key={`${entry.kind}-${entry.date}-${index}`}
                    className={entry.pending ? "text-muted-foreground" : undefined}
                  >
                    <TableCell>{formatShortDate(entry.date)}</TableCell>
                    <TableCell>
                      {entry.detail}
                      {entry.pending && (
                        <span className="ml-2 text-xs text-amber-700">
                          por confirmar
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {entry.kind === "cargo" ? formatCop(entry.amountCop) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {entry.kind === "abono" ? formatCop(entry.amountCop) : ""}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {entry.pending ? "—" : formatCop(runningBalances[index])}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Figure({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
        <div
          className={
            highlight
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
