import Link from "next/link";
import { redirect } from "next/navigation";
import { Printer } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getActiveRun, getRun, getRouteStops, listDeliverableRuns } from "@/modules/documents";
import { RunPicker } from "./run-picker";
import { formatCop } from "@/lib/money";
import { formatWeekdayDate } from "@/lib/dates";
import { RouteList } from "./route-list";
import { EmptyState } from "@/components/empty-state";
import { CsvButton } from "./csv-button";

export const metadata = { title: "Ruta · Toromana" };
export const dynamic = "force-dynamic";

export default async function RutaPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  // Por defecto la entrega de hoy, pero se puede mirar otra semana: pasa que
  // hay que revisar qué llevaba una ruta anterior.
  const { run: requested } = await searchParams;
  const [run, runs] = await Promise.all([
    requested ? getRun(requested) : getActiveRun(),
    listDeliverableRuns(),
  ]);

  if (!run) {
    return (
      <EmptyState title="No hay ruta para hoy">
        La ruta aparece cuando alguien confirma el pedido de la semana. Ahí
        vas a ver cada entrega con su dirección y sus cantidades, y podrás
        marcarlas a medida que las hagas.
      </EmptyState>
    );
  }

  const stops = await getRouteStops(run.id);
  const totalCop = stops.reduce((sum, stop) => sum + stop.totalCop, 0);
  const deliveredCount = stops.filter((s) => s.status === "entregado").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight capitalize">
            {formatWeekdayDate(run.deliveryDate)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {deliveredCount}/{stops.length} entregados · {formatCop(totalCop)} en ruta
          </p>
          {runs.length > 1 && <RunPicker runs={runs} current={run.id} />}
        </div>

        <div className="flex flex-wrap gap-2">
          <CsvButton stops={stops} deliveryDate={run.deliveryDate} />
          {/* El run va en la URL: sin él, quien está mirando una semana
              anterior imprime la de hoy sin darse cuenta. */}
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/ruta/imprimir?run=${run.id}`} target="_blank" />}
          >
            <Printer />
            Imprimir lista
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/ruta/institucional?run=${run.id}`} target="_blank" />
            }
          >
            <Printer />
            Recibos institucionales
          </Button>
        </div>
      </div>

      <RouteList stops={stops} />
    </div>
  );
}
