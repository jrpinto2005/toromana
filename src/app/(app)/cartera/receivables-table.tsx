"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaymentForm } from "./payment-form";
import { formatCop } from "@/lib/money";
import { formatAge, formatShortDate } from "@/lib/dates";
import {
  collectionMessage,
  OVERDUE_URGENCIES,
  whatsAppLink,
  type UrgencyLevel,
} from "@/modules/notifications";
import type { Receivable } from "@/modules/payments/client";
import { UrgencyBadge } from "./urgency-badge";
import { cn } from "@/lib/utils";

type Props = {
  rows: Receivable[];
  bankDetails: string;
  brandName: string;
  /** Vendedores presentes en la lista, para el filtro. */
  sellers: { id: string; name: string }[];
  handlers: { id: string; fullName: string }[];
  currentUserId: string;
};

export function ReceivablesTable({
  rows,
  bankDetails,
  brandName,
  sellers,
  handlers,
  currentUserId,
}: Props) {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<UrgencyLevel | "todos">("todos");
  const [sellerId, setSellerId] = useState<string>("todos");
  const [paying, setPaying] = useState<Receivable | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (level !== "todos" && row.urgencyLevel !== level) return false;
      if (sellerId !== "todos" && row.sellerId !== sellerId) return false;
      if (needle && !row.customerName.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, search, level, sellerId]);

  const shownTotal = filtered.reduce((sum, row) => sum + row.balanceCop, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar cliente…"
          className="h-9 w-full sm:w-64"
        />

        <div className="flex flex-wrap gap-1">
          <FilterChip
            active={level === "todos"}
            onClick={() => setLevel("todos")}
            label={`Todas (${rows.length})`}
          />
          {OVERDUE_URGENCIES.map((urgency) => {
            const count = rows.filter((r) => r.urgencyLevel === urgency.level).length;
            if (count === 0) return null;
            return (
              <FilterChip
                key={urgency.level}
                active={level === urgency.level}
                onClick={() => setLevel(urgency.level)}
                label={`${urgency.emoji} ${urgency.label} (${count})`}
              />
            );
          })}
        </div>

        {sellers.length > 1 && (
          <select
            value={sellerId}
            onChange={(event) => setSellerId(event.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
          >
            <option value="todos">Todos los vendedores</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Deuda más antigua</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nada por cobrar con estos filtros.
                </TableCell>
              </TableRow>
            )}

            {filtered.map((row) => {
              const message = collectionMessage({
                customerName: row.customerName,
                balanceCop: row.balanceCop,
                oldestUnpaidDate: row.oldestUnpaidDate,
                daysOverdue: row.daysOverdue,
                bankDetails,
                brandName,
              });
              const link = whatsAppLink(row.phone, message);

              return (
                <TableRow key={row.customerId}>
                  <TableCell className="font-medium">
                    <Link href={`/cartera/${row.customerId}`} className="hover:underline">
                      {row.customerName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <UrgencyBadge level={row.urgencyLevel} />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatCop(row.balanceCop)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.oldestUnpaidDate ? (
                      <>
                        {formatShortDate(row.oldestUnpaidDate)}{" "}
                        <span className="text-xs">({formatAge(row.daysOverdue)})</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.sellerName ?? "Sin asignar"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {link ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <a href={link} target="_blank" rel="noopener noreferrer" />
                          }
                        >
                          <MessageCircle />
                          WhatsApp
                        </Button>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                          title="Sin celular registrado: no se puede enviar WhatsApp"
                        >
                          <Phone className="size-3" />
                          Sin celular
                        </span>
                      )}
                      <Button size="sm" onClick={() => setPaying(row)}>
                        Pago
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} cliente{filtered.length === 1 ? "" : "s"} ·{" "}
        <span className="font-medium text-foreground">{formatCop(shownTotal)}</span> en pantalla
      </p>

      <Dialog open={paying !== null} onOpenChange={(open) => !open && setPaying(null)}>
        <DialogContent className="sm:max-w-md">
          {paying && (
            <>
              <DialogHeader>
                <DialogTitle>Registrar pago de {paying.customerName}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Saldo actual: {formatCop(paying.balanceCop)}
                </p>
              </DialogHeader>
              <PaymentForm
                customerId={paying.customerId}
                customerName={paying.customerName}
                balanceCop={paying.balanceCop}
                handlers={handlers}
                currentUserId={currentUserId}
                onDone={() => setPaying(null)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-input text-muted-foreground hover:bg-muted",
      )}
    >
      {label}
    </button>
  );
}
