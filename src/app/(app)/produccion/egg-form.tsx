"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatWeekdayDate, weekStart } from "@/lib/dates";
import { recordEggProduction, type HenLot } from "@/modules/production/client";

type Props = {
  lots: HenLot[];
  /** Producción ya capturada para la semana actual, para pre-llenar el formulario. */
  existing: Map<string, number>;
};

export function EggForm({ lots, existing }: Props) {
  const week = weekStart();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(lots.map((lot) => [lot.id, String(existing.get(lot.id) ?? "")])),
  );
  const [pending, startTransition] = useTransition();

  function submit(lotId: string) {
    const eggs = Number.parseInt(values[lotId] ?? "", 10);
    if (!Number.isInteger(eggs) || eggs < 0) {
      toast.error("Escribe los huevos de la semana.");
      return;
    }

    startTransition(async () => {
      const result = await recordEggProduction({ lotId, weekStart: week, eggs });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Producción guardada.");
    });
  }

  if (lots.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Producción de la semana</CardTitle>
        <p className="text-sm capitalize text-muted-foreground">{formatWeekdayDate(week)}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {lots.map((lot) => (
          <div key={lot.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
            <span className="flex-1 font-medium">{lot.code}</span>
            <span className="text-sm text-muted-foreground">{lot.currentCount} gallinas</span>
            <Input
              inputMode="numeric"
              value={values[lot.id] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [lot.id]: e.target.value }))}
              placeholder="Huevos"
              className="w-28"
            />
            <Button size="sm" disabled={pending} onClick={() => submit(lot.id)}>
              Guardar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
