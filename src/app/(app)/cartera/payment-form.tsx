"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCop, parseCop } from "@/lib/money";
import { today } from "@/lib/dates";
import { registerPayment, type PaymentMethod } from "@/modules/payments/client";

type Props = {
  customerId: string;
  customerName: string;
  balanceCop: number;
  handlers: { id: string; fullName: string }[];
  /** El usuario actual, para preseleccionar quién guarda el comprobante. */
  currentUserId: string;
  onDone?: () => void;
};

export function PaymentForm({
  customerId,
  customerName,
  balanceCop,
  handlers,
  currentUserId,
  onDone,
}: Props) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [paidAt, setPaidAt] = useState(today());
  const [receiptHolderId, setReceiptHolderId] = useState(currentUserId);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const amountCop = parseCop(amount);
  const overpaying = amountCop !== null && balanceCop > 0 && amountCop > balanceCop;

  function submit() {
    if (amountCop === null || amountCop <= 0) {
      toast.error("Escribe el monto del pago.");
      return;
    }

    startTransition(async () => {
      const result = await registerPayment({
        customerId,
        amountCop,
        method,
        paidAt,
        // Solo viaja en transferencias: en efectivo la base rechaza la fila.
        receiptHolderId: method === "transferencia" ? receiptHolderId : null,
        note,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(`Pago de ${formatCop(amountCop)} registrado a ${customerName}.`);
      setAmount("");
      setNote("");
      onDone?.();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="payment-amount">Monto</Label>
          <Input
            id="payment-amount"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
          />
          {amountCop !== null && (
            <p className="text-xs text-muted-foreground">{formatCop(amountCop)}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment-date">Fecha del pago</Label>
          <Input
            id="payment-date"
            type="date"
            value={paidAt}
            onChange={(event) => setPaidAt(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Medio</Label>
        <div className="flex gap-2">
          <MethodChip
            active={method === "transferencia"}
            onClick={() => setMethod("transferencia")}
            label="Transferencia"
          />
          <MethodChip
            active={method === "efectivo"}
            onClick={() => setMethod("efectivo")}
            label="Efectivo"
          />
        </div>
      </div>

      {method === "transferencia" && (
        <div className="space-y-1.5">
          <Label htmlFor="payment-holder">Comprobante en poder de</Label>
          <select
            id="payment-holder"
            value={receiptHolderId}
            onChange={(event) => setReceiptHolderId(event.target.value)}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
          >
            {handlers.map((handler) => (
              <option key={handler.id} value={handler.id}>
                {handler.fullName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="payment-note">Nota (opcional)</Label>
        <Textarea
          id="payment-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          placeholder="Referencia, número de comprobante, acuerdo…"
        />
      </div>

      {overpaying && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          El monto supera el saldo de {formatCop(balanceCop)}. Queda saldo a favor del
          cliente, que se descuenta de la próxima entrega.
        </p>
      )}

      <Button onClick={submit} disabled={pending} className="w-full">
        {pending ? "Registrando…" : "Registrar pago"}
      </Button>
    </div>
  );
}

function MethodChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
