import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { getPlanningInputs, getWeeklyDemandEggs } from '@/modules/production'
import { weekStart, today } from '@/lib/dates'
import { AnalyticsTabs } from '../tabs'
import { PlanView } from './plan-view'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Plan de producción · Toromana' }

export default async function PlanPage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  if (profile.role !== 'admin' && profile.role !== 'produccion') redirect('/')

  const [inputs, demand] = await Promise.all([
    getPlanningInputs(),
    getWeeklyDemandEggs(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Plan de producción
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Los lotes envejecen a destiempo, así que la producción total sube y
          baja sola. Aquí se ve hacia dónde va y qué hay que comprar para que
          deje de hacerlo.
        </p>
      </div>

      <AnalyticsTabs active="plan" />

      <PlanView
        lots={inputs.lots}
        history={inputs.history}
        model={inputs.model}
        firstWeekOfYear={inputs.firstWeekOfYear}
        actuals={inputs.actuals}
        hensOnHand={inputs.hensOnHand}
        demandPerWeek={demand}
        firstWeek={weekStart(today())}
      />
    </div>
  )
}
