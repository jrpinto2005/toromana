"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/dates";
import type { EggProductionEntry } from "@/modules/production/client";

export function LayingRateChart({ entries }: { entries: EggProductionEntry[] }) {
  const data = [...entries]
    .filter((e) => e.layingRate !== null)
    .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1))
    .map((e) => ({
      week: formatShortDate(e.weekStart),
      rate: Math.round((e.layingRate ?? 0) * 100),
    }));

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Todavía no hay suficiente producción registrada para trazar la curva.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="week" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} unit="%" />
          <Tooltip formatter={(value) => [`${value}%`, "Tasa de postura"]} />
          <Line type="monotone" dataKey="rate" stroke="var(--primary)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
