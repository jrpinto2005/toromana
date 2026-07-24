import Link from "next/link";
import { redirect } from "next/navigation";
import { Printer } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { getActiveRun, getRouteStops } from "@/modules/documents";
import { formatCop } from "@/lib/money";
import { formatWeekdayDate } from "@/lib/dates";
import { RouteList } from "./route-list";
import { CsvButton } from "./csv-button";

export const metadata = { title: "Ruta · Toromana" };
export const dynamic = "force-dynamic";

export default async function RutaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const run = await getActiveRun();

  if (!run) {
    return (
      <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
        No hay ningún pedido confirmado todavía. Cuando se confirme el pedido de la
        semana, la ruta aparece aquí.
      </div>
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
        </div>

        <div className="flex gap-2">
          <CsvButton stops={stops} deliveryDate={run.deliveryDate} />
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/ruta/imprimir" target="_blank" />}
          >
            <Printer />
            Imprimir
          </Button>
        </div>
      </div>

      <RouteList stops={stops} />
    </div>
  );
}
