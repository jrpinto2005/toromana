"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatShortDate, today } from "@/lib/dates";
import { recordLotEvent, retireHenLot, type HenLot, type LotEventType } from "@/modules/production/client";

const EVENT_LABEL: Record<LotEventType, string> = {
  mortalidad: "Mortalidad",
  venta: "Venta",
  ingreso: "Ingreso",
  descarte: "Descarte",
};

export function LotCard({ lot }: { lot: HenLot }) {
  const [expanded, setExpanded] = useState(false);
  const [type, setType] = useState<LotEventType>("mortalidad");
  const [quantity, setQuantity] = useState("");
  const [pending, startTransition] = useTransition();

  function submitEvent() {
    const qty = Number.parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty <= 0) {
      toast.error("Escribe una cantidad mayor que cero.");
      return;
    }

    startTransition(async () => {
      const result = await recordLotEvent({
        lotId: lot.id,
        eventDate: today(),
        type,
        quantity: qty,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${EVENT_LABEL[type]}: ${qty} en ${lot.code}.`);
      setQuantity("");
    });
  }

  function retire() {
    startTransition(async () => {
      const result = await retireHenLot(lot.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Lote ${lot.code} dado de baja.`);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            {lot.code}
            {lot.breed && <span className="text-sm font-normal text-muted-foreground">· {lot.breed}</span>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Desde {formatShortDate(lot.entryDate)} · inicial {lot.initialCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-base">
            {lot.currentCount}
          </Badge>
          <Button size="icon-sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp /> : <ChevronDown />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 border-t pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label>Movimiento</Label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as LotEventType)}
                className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
              >
                {Object.entries(EVENT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`qty-${lot.id}`}>Cantidad</Label>
              <Input
                id={`qty-${lot.id}`}
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-24"
              />
            </div>
            <Button size="sm" disabled={pending} onClick={submitEvent}>
              Registrar
            </Button>
            <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground" disabled={pending} onClick={retire}>
              Dar de baja el lote
            </Button>
          </div>
          {lot.notes && <p className="text-sm text-muted-foreground">{lot.notes}</p>}
        </CardContent>
      )}
    </Card>
  );
}
