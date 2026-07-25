"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, MapPin, Phone, Receipt, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCop, parseCop } from "@/lib/money";
import { markDelivered, undoDelivered, type RouteStop } from "@/modules/documents/client";
import { reportCashFromRoute } from "@/modules/payments/client";
import { cn } from "@/lib/utils";

export function RouteList({ stops }: { stops: RouteStop[] }) {
  const [cashFor, setCashFor] = useState<RouteStop | null>(null);
  const [search, setSearch] = useState("");

  // Con treinta y pico de entregas, encontrar a alguien en el celular
  // desplazando la lista con una mano y una cubeta en la otra no es viable.
  // La búsqueda cubre nombre y dirección: quien reparte a veces recuerda el
  // edificio y no el nombre.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stops;
    return stops.filter(
      (s) =>
        s.customerName.toLowerCase().includes(q) ||
        (s.address ?? "").toLowerCase().includes(q),
    );
  }, [stops, search]);

  const pending = visible.filter((s) => s.status !== "entregado");
  const done = visible.filter((s) => s.status === "entregado");

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 backdrop-blur">
        <Input
          type="search"
          inputMode="search"
          placeholder="Buscar cliente o dirección…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-11 text-base"
        />
        {search && (
          <p className="mt-1 text-xs text-muted-foreground">
            {visible.length} de {stops.length} entregas
            {visible.length === 0 && " · nadie coincide"}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Por entregar ({pending.length})
        </h2>
        {pending.length === 0 && (
          <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            {search ? "Nadie pendiente con esa búsqueda." : "Ya entregaste todo lo de hoy."}
          </p>
        )}
        <div className="space-y-3">
          {pending.map((stop) => (
            <StopCard key={stop.orderId} stop={stop} onReportCash={() => setCashFor(stop)} />
          ))}
        </div>
      </div>

      {done.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Entregado ({done.length})
          </h2>
          <div className="space-y-3">
            {done.map((stop) => (
              <StopCard key={stop.orderId} stop={stop} onReportCash={() => setCashFor(stop)} />
            ))}
          </div>
        </div>
      )}

      <Dialog open={cashFor !== null} onOpenChange={(open) => !open && setCashFor(null)}>
        <DialogContent className="sm:max-w-sm">
          {cashFor && <CashForm stop={cashFor} onDone={() => setCashFor(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StopCard({
  stop,
  onReportCash,
}: {
  stop: RouteStop;
  onReportCash: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const delivered = stop.status === "entregado";

  function toggle() {
    startTransition(async () => {
      const result = delivered
        ? await undoDelivered(stop.orderId)
        : await markDelivered(stop.orderId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(delivered ? "Entrega deshecha." : `${stop.customerName}: entregado.`);
    });
  }

  return (
    <Card className={cn(delivered && "opacity-70")}>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{stop.customerName}</span>
              {delivered && (
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                  Entregado
                </Badge>
              )}
            </div>
            {stop.address && (
              <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {stop.address}
              </p>
            )}
            {stop.phone && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Phone className="size-3.5" />
                {stop.phone}
              </p>
            )}
          </div>
          <span className="font-mono text-lg tabular-nums">{formatCop(stop.totalCop)}</span>
        </div>

        <ul className="text-sm text-muted-foreground">
          {stop.items.map((item) => (
            <li key={item.productId}>
              {item.quantity} {item.unit} de {item.productName}
            </li>
          ))}
        </ul>

        {stop.note && (
          <p className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            {stop.note}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/ruta/recibo/${stop.orderId}`} target="_blank" />}
          >
            <Receipt />
            Recibo
          </Button>
          <Button size="sm" variant="outline" onClick={onReportCash}>
            Reportar efectivo
          </Button>
          <Button size="sm" className="ml-auto" disabled={pending} onClick={toggle}>
            {delivered ? <Undo2 /> : <Check />}
            {delivered ? "Deshacer" : "Marcar entregado"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CashForm({ stop, onDone }: { stop: RouteStop; onDone: () => void }) {
  const [amount, setAmount] = useState(String(stop.totalCop));
  const [pending, startTransition] = useTransition();

  function submit() {
    const amountCop = parseCop(amount);
    if (amountCop === null || amountCop <= 0) {
      toast.error("Escribe el monto recibido.");
      return;
    }

    startTransition(async () => {
      const result = await reportCashFromRoute({
        customerId: stop.customerId,
        amountCop,
        orderId: stop.orderId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Reportado: ${formatCop(amountCop)} de ${stop.customerName}. Falta que contabilidad lo confirme.`);
      onDone();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Efectivo de {stop.customerName}</DialogTitle>
        <p className="text-sm text-muted-foreground">
          Queda como pendiente hasta que contabilidad lo confirme.
        </p>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="cash-amount">Monto recibido</Label>
        <Input
          id="cash-amount"
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={pending} className="w-full">
          {pending ? "Reportando…" : "Reportar"}
        </Button>
      </DialogFooter>
    </>
  );
}
