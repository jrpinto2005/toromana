import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { listEggProduction, listHenLots } from "@/modules/production";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatShortDate } from "@/lib/dates";
import { LayingRateChart } from "./laying-rate-chart";
import { AnalyticsTabs } from "./tabs";

export const metadata = { title: "Analítica · Toromana" };
export const dynamic = "force-dynamic";

function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export default async function AnaliticaPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const [lots, entries] = await Promise.all([
    listHenLots({ includeInactive: true }),
    listEggProduction(),
  ]);

  const totalHens = lots.filter((l) => l.active).reduce((sum, l) => sum + l.currentCount, 0);
  const latestWeek = entries[0]?.weekStart;
  const latestEntries = entries.filter((e) => e.weekStart === latestWeek);
  const latestEggs = latestEntries.reduce((sum, e) => sum + e.eggs, 0);
  const avgRate =
    latestEntries.length > 0
      ? latestEntries.reduce((sum, e) => sum + (e.layingRate ?? 0), 0) / latestEntries.length
      : null;

  return (
    <div className="space-y-6">
      <AnalyticsTabs active="produccion" />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analítica</h1>
        <p className="text-sm text-muted-foreground">
          Tasa de postura y producción por lote en el tiempo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="Gallinas activas" value={String(totalHens)} />
        <Figure
          label={latestWeek ? `Huevos, semana ${formatShortDate(latestWeek)}` : "Huevos última semana"}
          value={String(latestEggs)}
        />
        <Figure label="Tasa de postura promedio" value={formatRate(avgRate)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasa de postura en el tiempo</CardTitle>
          <p className="text-sm text-muted-foreground">huevos / (gallinas × 7), por semana</p>
        </CardHeader>
        <CardContent>
          <LayingRateChart entries={entries} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Producción semanal por lote</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead className="text-right">Huevos</TableHead>
                <TableHead className="text-right">Tasa de postura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Sin producción registrada todavía.
                  </TableCell>
                </TableRow>
              )}
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{formatShortDate(entry.weekStart)}</TableCell>
                  <TableCell>{entry.lotCode}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{entry.eggs}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatRate(entry.layingRate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </div>
        <div className="mt-1 font-mono text-2xl tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
