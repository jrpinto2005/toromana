"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { today } from "@/lib/dates";
import { createHenLot } from "@/modules/production/client";

export function NewLotDialog() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [entryDate, setEntryDate] = useState(today());
  const [initialCount, setInitialCount] = useState("");
  const [breed, setBreed] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const count = Number.parseInt(initialCount, 10);
    if (!code.trim()) {
      toast.error("Escribe el código del lote.");
      return;
    }
    if (!Number.isInteger(count) || count < 0) {
      toast.error("Escribe la cantidad inicial de gallinas.");
      return;
    }

    startTransition(async () => {
      const result = await createHenLot({
        code,
        entryDate,
        initialCount: count,
        breed: breed || null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Lote ${code} creado.`);
      setCode("");
      setInitialCount("");
      setBreed("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus />
            Nuevo lote
          </Button>
        }
      />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo lote de gallinas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="lot-code">Código</Label>
            <Input id="lot-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lot-entry">Fecha de entrada</Label>
            <Input
              id="lot-entry"
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lot-count">Cantidad inicial</Label>
            <Input
              id="lot-count"
              inputMode="numeric"
              value={initialCount}
              onChange={(e) => setInitialCount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lot-breed">Raza (opcional)</Label>
            <Input id="lot-breed" value={breed} onChange={(e) => setBreed(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={submit} disabled={pending} className="w-full">
            {pending ? "Creando…" : "Crear lote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
