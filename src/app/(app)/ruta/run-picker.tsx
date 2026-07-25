"use client";

import { useRouter } from "next/navigation";
import { formatWeekdayDate } from "@/lib/dates";

type Run = { id: string; deliveryDate: string };

/** Cambiar de semana sin salir de la ruta. */
export function RunPicker({ runs, current }: { runs: Run[]; current: string }) {
  const router = useRouter();

  return (
    <select
      value={current}
      onChange={(e) => router.push(`/ruta?run=${e.target.value}`)}
      className="mt-2 h-8 rounded-md border bg-background px-2 text-sm capitalize"
    >
      {runs.map((run) => (
        <option key={run.id} value={run.id}>
          {formatWeekdayDate(run.deliveryDate)}
        </option>
      ))}
    </select>
  );
}
