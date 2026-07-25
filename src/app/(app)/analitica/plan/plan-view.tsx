'use client'

import { useMemo, useState } from 'react'
import {
  plan as buildPlan,
  targetAt,
  LOT_STEP,
  MIN_LOT,
  WEEKS_TO_LAY,
  type Fit,
  type PlannedLot,
} from '@/modules/production/client'
import { addDays, formatShortDate, type IsoDate } from '@/lib/dates'
import { ProjectionChart } from './projection-chart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type LotHistory = {
  id: string
  code: string
  entryDate: IsoDate
  expectedExitDate: IsoDate | null
  currentCount: number
  active: boolean
}

const HORIZON = 52

export function PlanView({
  lots,
  history,
  fit,
  actuals,
  hensOnHand,
  demandPerWeek,
  firstWeek,
}: {
  lots: PlannedLot[]
  history: LotHistory[]
  fit: Fit
  actuals: { weekStart: IsoDate; eggs: number }[]
  hensOnHand: number
  demandPerWeek: number
  firstWeek: IsoDate
}) {
  // La meta arranca en la demanda comprometida, no en un número redondo: la
  // pregunta del negocio no es "cuántos huevos queremos" sino "cuántos nos
  // están pidiendo".
  const [target, setTarget] = useState(demandPerWeek || 2200)
  const [scenario, setScenario] = useState<{
    fromWeek: number
    weeks: number
    eggsPerWeek: number
  } | null>(null)

  const targetSpec = useMemo(
    () => ({
      eggsPerWeek: target,
      adjustments: scenario
        ? [
            {
              fromWeek: scenario.fromWeek,
              toWeek: scenario.fromWeek + scenario.weeks - 1,
              eggsPerWeek: scenario.eggsPerWeek,
            },
          ]
        : undefined,
    }),
    [target, scenario],
  )

  // El plan se recalcula en el navegador: mover la meta y ver el efecto al
  // instante es lo que convierte esto en una herramienta de decisión y no en
  // un reporte.
  const result = useMemo(
    () => buildPlan(lots, fit.params, targetSpec, HORIZON),
    [lots, fit.params, targetSpec],
  )

  const weekDate = (week: number) => addDays(firstWeek, week * 7)
  const lastActual = actuals.at(-1)?.eggs ?? 0

  // Sin comprar nada, ¿cuándo se cae por debajo de la meta?
  const firstGap = result.baseline.findIndex(
    (w) => w.total < targetAt(targetSpec, w.week),
  )

  const lotNames = new Map<string, string>([
    ...history.map((h) => [h.id, h.code] as [string, string]),
    ...result.proposedLots.map((l) => [l.id, l.code] as [string, string]),
  ])

  return (
    <div className="space-y-6">
      {/* ── Estado de hoy ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gallinas en galpón" value={hensOnHand.toLocaleString('es-CO')} />
        <Stat
          label="Producción última semana"
          value={lastActual.toLocaleString('es-CO')}
          hint="huevos"
        />
        <Stat
          label="Demanda comprometida"
          value={demandPerWeek.toLocaleString('es-CO')}
          hint="huevos por semana"
        />
        <Stat
          label={firstGap === -1 ? 'Cobertura' : 'Falta producción en'}
          value={
            firstGap === -1
              ? 'Todo el año'
              : firstGap === 0
                ? 'Ya mismo'
                : `${firstGap} sem`
          }
          hint={firstGap === -1 ? 'sin comprar nada' : `desde el ${formatShortDate(weekDate(firstGap))}`}
          tone={firstGap === -1 ? 'ok' : firstGap <= 8 ? 'alert' : 'warn'}
        />
      </div>

      {/* ── De dónde sale el modelo ── */}
      <ModelNote fit={fit} />

      {/* ── Meta ── */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-background p-4">
        <div className="space-y-1.5">
          <Label htmlFor="target">Meta semanal (huevos)</Label>
          <Input
            id="target"
            type="number"
            step={100}
            min={0}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value) || 0)}
            className="w-36"
          />
        </div>

        <div className="flex gap-2">
          {[demandPerWeek, Math.round(demandPerWeek * 1.2), 3000].map((preset, i) => (
            <Button
              key={i}
              type="button"
              variant={target === preset ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTarget(preset)}
            >
              {i === 0 ? 'Demanda actual' : i === 1 ? '+20%' : '3.000'}
            </Button>
          ))}
        </div>

        <ScenarioControl scenario={scenario} onChange={setScenario} target={target} />
      </div>

      {/* ── Proyección ── */}
      <ProjectionChart
        projection={result.projection}
        baseline={result.baseline}
        lotNames={lotNames}
        proposedIds={new Set(result.proposedLots.map((l) => l.id))}
        targetFor={(week) => targetAt(targetSpec, week)}
        weekDate={weekDate}
      />

      {/* ── Qué hacer ── */}
      <Purchases
        purchases={result.purchases}
        weekDate={weekDate}
        shortfallWeeks={result.shortfallWeeks}
      />

      {/* ── Salidas previstas ── */}
      <Exits history={history} />
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'ok' | 'warn' | 'alert'
}) {
  const toneClass = {
    neutral: '',
    ok: 'text-emerald-700 dark:text-emerald-400',
    warn: 'text-amber-700 dark:text-amber-400',
    alert: 'text-red-700 dark:text-red-400',
  }[tone]

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

/**
 * De dónde salen los números.
 *
 * Un modelo que no dice cuánto sabe invita a creerle de más. Con pocas semanas
 * de historia la curva es un supuesto de la especie, no un aprendizaje, y eso
 * tiene que estar escrito en la pantalla y no en la documentación.
 */
function ModelNote({ fit }: { fit: Fit }) {
  const pct = Math.round(fit.confidence * 100)
  const learned = pct >= 60

  return (
    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">
          {learned
            ? 'Curva ajustada a la historia del galpón'
            : 'Curva estimada, todavía con poca historia'}
        </span>
        <span className="text-muted-foreground">
          · {fit.observations} semanas de datos · {pct}% del modelo viene de tus
          registros
        </span>
      </div>
      <p className="mt-1 text-muted-foreground">
        Pico de {fit.params.peakRate.toFixed(2)} huevos por gallina al día, que
        se alcanza a las {Math.round(fit.params.onsetWeeks + 4)} semanas y se
        sostiene hasta la {Math.round(fit.params.plateauWeeks)}. Error medio del
        ajuste: {fit.rmse.toFixed(3)} huevos por gallina al día.
        {!learned && (
          <>
            {' '}
            Mientras haya poca historia el modelo se apoya en el comportamiento
            típico de la especie; cada semana que Producción registra lo corrige.
          </>
        )}
      </p>
    </div>
  )
}

function ScenarioControl({
  scenario,
  onChange,
  target,
}: {
  scenario: { fromWeek: number; weeks: number; eggsPerWeek: number } | null
  onChange: (s: { fromWeek: number; weeks: number; eggsPerWeek: number } | null) => void
  target: number
}) {
  if (!scenario) {
    return (
      <div className="ml-auto flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({ fromWeek: 12, weeks: 4, eggsPerWeek: Math.round(target * 1.4) })
          }
        >
          Simular un pico
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({ fromWeek: 12, weeks: 4, eggsPerWeek: Math.round(target * 0.7) })
          }
        >
          Simular una caída
        </Button>
      </div>
    )
  }

  return (
    <div className="ml-auto flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Meta</Label>
        <Input
          type="number"
          step={100}
          value={scenario.eggsPerWeek}
          onChange={(e) =>
            onChange({ ...scenario, eggsPerWeek: Number(e.target.value) || 0 })
          }
          className="w-28"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Desde la semana</Label>
        <Input
          type="number"
          min={0}
          max={51}
          value={scenario.fromWeek}
          onChange={(e) =>
            onChange({ ...scenario, fromWeek: Number(e.target.value) || 0 })
          }
          className="w-20"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Durante</Label>
        <Input
          type="number"
          min={1}
          max={26}
          value={scenario.weeks}
          onChange={(e) => onChange({ ...scenario, weeks: Number(e.target.value) || 1 })}
          className="w-20"
        />
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
        Quitar
      </Button>
    </div>
  )
}

function Purchases({
  purchases,
  weekDate,
  shortfallWeeks,
}: {
  purchases: { orderAtWeek: number; layingFromWeek: number; hens: number; deficit: number }[]
  weekDate: (week: number) => IsoDate
  shortfallWeeks: number[]
}) {
  if (purchases.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
        <span className="font-medium">No hay que comprar nada este año.</span> Con
        los lotes que ya están en el galpón la meta se sostiene.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Qué hay que comprar</h2>

      <ol className="space-y-2">
        {purchases.map((purchase, index) => {
          const urgent = purchase.orderAtWeek <= 2
          return (
            <li
              key={index}
              className={`rounded-lg border p-4 ${
                urgent
                  ? 'border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
                  : 'bg-background'
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-lg font-semibold tabular-nums">
                  {purchase.hens} pollonas
                </span>
                <span className="text-sm">
                  {purchase.orderAtWeek === 0 ? (
                    <strong>pedirlas ya</strong>
                  ) : (
                    <>
                      pedirlas antes del{' '}
                      <strong>{formatShortDate(weekDate(purchase.orderAtWeek))}</strong>
                    </>
                  )}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Empiezan a producir hacia el{' '}
                {formatShortDate(weekDate(purchase.layingFromWeek))}, justo cuando
                faltarían {Math.round(purchase.deficit).toLocaleString('es-CO')}{' '}
                huevos por semana. Las pollonas entran a punto de postura y tardan
                unas {WEEKS_TO_LAY} semanas en arrancar, así que este es el último
                momento para pedirlas.
              </p>
            </li>
          )
        })}
      </ol>

      {shortfallWeeks.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Aun comprando, quedan {shortfallWeeks.length} semanas por debajo de la
          meta: los lotes no alcanzan a arrancar a tiempo. Para cerrarlas habría
          que subir la meta más adelante o comprar más grande.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Los lotes se piden desde {MIN_LOT} y en múltiplos de {LOT_STEP}.
      </p>
    </div>
  )
}

function Exits({ history }: { history: LotHistory[] }) {
  const active = history.filter((h) => h.active)
  if (active.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="font-semibold">Lotes en el galpón</h2>
      <div className="overflow-x-auto rounded-lg border bg-background">
        <table className="w-full text-sm">
          <thead className="border-b text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Lote</th>
              <th className="px-4 py-2 font-medium">Entró</th>
              <th className="px-4 py-2 font-medium">Gallinas</th>
              <th className="px-4 py-2 font-medium">Salida prevista</th>
            </tr>
          </thead>
          <tbody>
            {active.map((lot) => {
              const overdue =
                lot.expectedExitDate !== null &&
                lot.expectedExitDate < new Date().toISOString().slice(0, 10)

              return (
                <tr key={lot.id} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium">{lot.code}</td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {formatShortDate(lot.entryDate)}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{lot.currentCount}</td>
                  <td className="px-4 py-2">
                    {lot.expectedExitDate ? (
                      <span
                        className={
                          overdue ? 'font-medium text-red-700 dark:text-red-400' : ''
                        }
                      >
                        {formatShortDate(lot.expectedExitDate)}
                        {overdue && ' · ya debió salir'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">sin definir</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
