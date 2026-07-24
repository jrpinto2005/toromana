"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSequenceNumber } from "./actions";

type Sequence = { name: string; nextNumber: number };

const LABEL: Record<string, string> = {
  general: "General (Institucional A + Institucional C)",
  institucional_b: "Institucional B",
};

export function SequencesPanel({ sequences }: { sequences: Sequence[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Consecutivos de recibos</CardTitle>
        <p className="text-sm text-muted-foreground">
          Cada secuencia lleva su propia numeración. Ajusta solo si se desfasa contra el
          histórico en papel.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {sequences.map((seq) => (
          <SequenceRow key={seq.name} sequence={seq} />
        ))}
      </CardContent>
    </Card>
  );
}

function SequenceRow({ sequence }: { sequence: Sequence }) {
  const [value, setValue] = useState(String(sequence.nextNumber));
  const [pending, startTransition] = useTransition();

  const parsed = Number.parseInt(value, 10);
  const dirty = Number.isInteger(parsed) && parsed !== sequence.nextNumber;

  function save() {
    if (!Number.isInteger(parsed) || parsed <= 0) {
      toast.error("Escribe un número entero mayor que cero.");
      return;
    }
    startTransition(async () => {
      const result = await updateSequenceNumber(sequence.name, parsed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${LABEL[sequence.name] ?? sequence.name}: próximo será ${parsed}.`);
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <div className="flex-1">
        <p className="font-medium">{LABEL[sequence.name] ?? sequence.name}</p>
        <p className="text-xs text-muted-foreground">próximo número</p>
      </div>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        inputMode="numeric"
        className="w-24"
      />
      <Button size="sm" disabled={!dirty || pending} onClick={save}>
        Guardar
      </Button>
    </div>
  );
}
