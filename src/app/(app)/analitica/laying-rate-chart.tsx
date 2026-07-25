"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatShortDate } from "@/lib/dates";
import type { WeeklyLayingRate } from "@/modules/production/client";

/**
 * Tasa de postura del galpón, semana a semana.
 *
 * Una sola serie: cuántos huevos pone al día una gallina promedio. No lleva
 * leyenda porque el título ya dice qué es — una caja de leyenda para una sola
 * serie es ruido.
 *
 * Antes esto graficaba una fila por lote, semana y tamaño de huevo, todas
 * mezcladas en una línea: un zigzag sin significado. Ahora cada punto es una
 * semana del galpón completo.
 *
 * Es el promedio de lotes de distintas edades, así que sube y baja cuando entra
 * un lote nuevo o cuando uno viejo entra en muda. Para ver de cuál lote viene
 * el movimiento está el plan de producción.
 */
export function LayingRateChart({ weeks }: { weeks: WeeklyLayingRate[] }) {
  const data = weeks.map((w) => ({
    week: formatShortDate(w.weekStart),
    rate: Math.round(w.rate * 1000) / 10,
    eggs: w.eggs,
    hens: w.hens,
    small: w.smallEggs,
  }));

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Todavía no hay producción registrada para trazar la curva.
      </p>
    );
  }

  return (
    <div className="viz-rate h-72 w-full">
      <style>{`
        .viz-rate {
          --surface-1: #ffffff;
          --text-secondary: #52514e;
          --grid: #e7e5e0;
          --series-1: #2a78d6;
        }
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) .viz-rate {
            --surface-1: #0a0a0a;
            --text-secondary: #c3c2b7;
            --grid: #2a2a28;
            --series-1: #3987e5;
          }
        }
        :root[data-theme="dark"] .viz-rate {
          --surface-1: #0a0a0a;
          --text-secondary: #c3c2b7;
          --grid: #2a2a28;
          --series-1: #3987e5;
        }
      `}</style>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--series-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="var(--grid)" vertical={false} />

          <XAxis
            dataKey="week"
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--grid)" }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
          />

          <Tooltip content={<RateTooltip />} />

          <Area
            type="monotone"
            dataKey="rate"
            stroke="var(--series-1)"
            strokeWidth={2}
            fill="url(#rateFill)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type Point = { rate: number; eggs: number; hens: number; small: number };

function RateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{p.rate}%</div>
      <div className="text-xs text-muted-foreground">
        {p.eggs.toLocaleString("es-CO")} huevos · {p.hens.toLocaleString("es-CO")}{" "}
        gallinas
      </div>
      {p.small > 0 && (
        <div className="text-xs text-muted-foreground">
          {Math.round((p.small / p.eggs) * 100)}% huevo pequeño
        </div>
      )}
    </div>
  );
}
