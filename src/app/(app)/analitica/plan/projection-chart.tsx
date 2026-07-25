'use client'

import { useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { WeekProjection } from '@/modules/production/client'
import { formatShortDate, type IsoDate } from '@/lib/dates'

/**
 * Producción proyectada, en dos vistas que responden preguntas distintas.
 *
 * **Apiladas** responde "¿alcanza el total?". Sirve para eso y solo para eso:
 * en una pila, el borde superior de cada franja va arrastrado por la suma de
 * las de abajo, así que todas parecen subir y bajar juntas aunque cada lote
 * siga su propio ciclo. Lo único que codifica el valor de un lote es el grosor
 * de su franja, y el ojo lo lee mal.
 *
 * **Por lote** responde "¿por qué?". Sin apilar, cada línea es la curva de ese
 * lote y nada más: se ve dónde está su pico, dónde su muda, y —lo que importa
 * para decidir— si el valle de uno cae sobre el pico de otro. Esa es la vista
 * donde el escalonamiento se puede juzgar.
 */

// Paleta categórica en orden fijo. El orden es el mecanismo de seguridad para
// daltonismo, no una preferencia estética: no se rota ni se reasigna.
//
// Los colores van como variables CSS y no como literales, para que el modo
// oscuro use su propia versión —los mismos tonos re-escalonados contra el
// fondo oscuro— en vez de invertir los claros, que quedarían ilegibles.
const SLOTS = 6
const seriesVar = (index: number) => `var(--series-${(index % SLOTS) + 1})`

type Props = {
  projection: WeekProjection[]
  baseline: WeekProjection[]
  lotNames: Map<string, string>
  proposedIds: Set<string>
  targetFor: (week: number) => number
  weekDate: (week: number) => IsoDate
}

export function ProjectionChart({
  projection,
  baseline,
  lotNames,
  proposedIds,
  targetFor,
  weekDate,
}: Props) {
  // Apilado responde "¿alcanza el total?"; por lote responde "¿por qué?".
  // Hacen falta los dos: en el apilado el borde de cada franja arrastra la suma
  // de las de abajo, así que ahí no se puede leer la curva de un lote.
  const [mode, setMode] = useState<'apiladas' | 'individuales'>('apiladas')

  // El orden de las series es fijo: cada lote conserva su color en los dos
  // modos. El color identifica al lote, no a su posición en la pila.
  const lotIds = [...new Set(projection.flatMap((w) => Object.keys(w.byLot)))]
  const existing = lotIds.filter((id) => !proposedIds.has(id))
  const proposed = lotIds.filter((id) => proposedIds.has(id))
  const ordered = [...existing, ...proposed]

  const data = projection.map((week, index) => ({
    week: week.week,
    fecha: formatShortDate(weekDate(week.week)),
    meta: targetFor(week.week),
    sinComprar: baseline[index]?.total ?? 0,
    total: week.total,
    // `null` y no 0 cuando el lote no está: en modo línea, un cero dibuja una
    // caída al piso que parece producción perdida en vez de un lote que salió.
    ...Object.fromEntries(
      ordered.map((id) => [id, week.byLot[id] ?? (mode === 'apiladas' ? 0 : null)]),
    ),
  }))

  return (
    <div className="viz-root rounded-lg border bg-background p-4">
      <style>{`
        .viz-root {
          --surface-1: #ffffff;
          --text-secondary: #52514e;
          --grid: #e7e5e0;
          --series-1: #2a78d6;
          --series-2: #eb6834;
          --series-3: #1baf7a;
          --series-4: #eda100;
          --series-5: #e87ba4;
          --series-6: #008300;
          --target: #e34948;
        }
        /* El interruptor de tema pone la clase dark en el html, y ese script
           corre antes de pintar. Es la unica fuente de verdad: consultar
           ademas prefers-color-scheme haria que el grafico ignorara una
           eleccion explicita del usuario. */
        .dark .viz-root {
          --surface-1: #0a0a0a;
          --text-secondary: #c3c2b7;
          --grid: #2a2a28;
          --series-1: #3987e5;
          --series-2: #d95926;
          --series-3: #199e70;
          --series-4: #c98500;
          --series-5: #d55181;
          --series-6: #008300;
          --target: #e66767;
        }
      `}</style>

      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            Producción proyectada · {projection.length} semanas
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === 'apiladas'
              ? 'Cada franja es un lote y se suman. La línea punteada es la meta.'
              : 'Cada línea es un lote por separado, para comparar en qué momento de su ciclo va cada uno.'}
          </p>
        </div>

        <div className="flex gap-1">
          {(
            [
              ['apiladas', 'Apiladas'],
              ['individuales', 'Por lote'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'individuales' && (
        <p className="mb-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Sin apilar y sin la meta: a esta escala un solo lote llega a unos mil
          huevos y la meta está sobre dos mil, así que dibujarla aplastaría las
          curvas. Lo que se busca aquí es otra cosa — ver si el valle de muda de
          un lote coincide con el pico de otro, que es de lo que depende que la
          suma quede plana.
        </p>
      )}

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {/* Los lotes propuestos van rayados: todavía no existen, y el
                  color solo no debería ser lo que distingue lo real de lo
                  sugerido. */}
              {proposed.map((id, index) => {
                const color = seriesVar(existing.length + index)
                return (
                  <pattern
                    key={id}
                    id={`hatch-${id}`}
                    patternUnits="userSpaceOnUse"
                    width={6}
                    height={6}
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="6" fill={color} opacity={0.25} />
                    <line x1="0" y1="0" x2="0" y2="6" stroke={color} strokeWidth={2.5} />
                  </pattern>
                )
              })}
            </defs>

            <CartesianGrid stroke="var(--grid)" vertical={false} />

            <XAxis
              dataKey="fecha"
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--grid)' }}
              interval={6}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v: number) => v.toLocaleString('es-CO')}
            />

            <Tooltip content={<ProjectionTooltip lotNames={lotNames} />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value: string) => lotNames.get(value) ?? value}
            />

            {mode === 'apiladas' &&
              ordered.map((id, index) => {
                const isProposed = proposedIds.has(id)
                const color = seriesVar(index)
                return (
                  <Area
                    key={id}
                    type="monotone"
                    dataKey={id}
                    name={id}
                    stackId="produccion"
                    fill={isProposed ? `url(#hatch-${id})` : color}
                    fillOpacity={isProposed ? 1 : 0.85}
                    // 2px del color de la superficie: separa las capas sin
                    // agregar una línea que compita con los datos.
                    stroke="var(--surface-1)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                )
              })}

            {mode === 'individuales' &&
              ordered.map((id, index) => (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={id}
                  stroke={seriesVar(index)}
                  strokeWidth={2}
                  // Los propuestos van punteados: es la misma distinción que
                  // en el apilado, donde van rayados.
                  strokeDasharray={proposedIds.has(id) ? '5 4' : undefined}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls={false}
                />
              ))}

            {/* La meta va en dos trazos: primero un halo del color de la
                superficie, que le abre un canal entre las franjas y la deja
                legible por encima de cualquier color; encima el trazo rojo.
                Sin el halo, la línea se pierde justo donde más importa mirarla,
                que es cuando la producción la está cruzando.

                El rojo queda a ΔE 7.2 del verde del sexto lote para visión
                protán — dentro de la banda que exige codificación secundaria.
                La tiene, y no es sutil: la meta es una LÍNEA punteada con halo
                y los lotes son áreas rellenas. Se distinguen por forma antes
                que por color. */}
            {mode === 'apiladas' && (
              <Line
                type="stepAfter"
                dataKey="meta"
                stroke="var(--surface-1)"
                strokeWidth={3}
                dot={false}
                legendType="none"
                isAnimationActive={false}
              />
            )}
            {mode === 'apiladas' && (
              <Line
                type="stepAfter"
                dataKey="meta"
                name="Meta"
                stroke="var(--target)"
                strokeWidth={2}
                strokeDasharray="9 5"
                dot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* La tabla no es un extra: es lo que hace legible el gráfico para quien
          no distingue los colores, y lo que permite copiar un número exacto. */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground">
          Ver los números
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-background text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Semana</th>
                <th className="px-3 py-2 text-right font-medium">Con el plan</th>
                <th className="px-3 py-2 text-right font-medium">Sin comprar</th>
                <th className="px-3 py-2 text-right font-medium">Meta</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const short = row.total < row.meta
                return (
                  <tr key={row.week} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{row.fecha}</td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        short ? 'font-medium text-red-700 dark:text-red-400' : ''
                      }`}
                    >
                      {row.total.toLocaleString('es-CO')}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.sinComprar.toLocaleString('es-CO')}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.meta.toLocaleString('es-CO')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

type TooltipPayload = {
  dataKey: string
  value: number
  color: string
}

function ProjectionTooltip({
  active,
  payload,
  label,
  lotNames,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
  lotNames: Map<string, string>
}) {
  if (!active || !payload?.length) return null

  const meta = payload.find((p) => p.dataKey === 'meta')?.value ?? 0
  const lots = payload.filter(
    (p) => p.dataKey !== 'meta' && typeof p.value === 'number' && p.value > 0,
  )
  const total = lots.reduce((sum, p) => sum + p.value, 0)

  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      <div className="font-medium">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums">
          {total.toLocaleString('es-CO')}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="inline-block h-[3px] w-4 rounded-full"
            style={{ background: 'var(--target)' }}
          />
          meta {meta.toLocaleString('es-CO')}
        </span>
      </div>
      {total < meta && (
        <div className="text-xs text-red-700 dark:text-red-400">
          faltan {(meta - total).toLocaleString('es-CO')}
        </div>
      )}
      <ul className="mt-2 space-y-0.5">
        {lots.map((p) => (
          <li key={p.dataKey} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className="size-2.5 rounded-[2px]"
              style={{ background: p.color }}
            />
            <span className="text-muted-foreground">
              {lotNames.get(p.dataKey) ?? p.dataKey}
            </span>
            <span className="ml-auto tabular-nums">
              {p.value.toLocaleString('es-CO')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
