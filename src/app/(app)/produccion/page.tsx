import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { listEggProduction, listHenLots } from "@/modules/production";
import { weekStart } from "@/lib/dates";
import { NewLotDialog } from "./new-lot-dialog";
import { LotCard } from "./lot-card";
import { EggForm } from "./egg-form";

export const metadata = { title: "Producción · Toromana" };
export const dynamic = "force-dynamic";

export default async function ProduccionPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin" && profile.role !== "produccion") redirect("/");

  const week = weekStart();
  const [lots, thisWeek] = await Promise.all([
    listHenLots(),
    listEggProduction({ weekStart: week }),
  ]);

  const existing = new Map(thisWeek.map((row) => [row.lotId, row.eggs]));
  const totalHens = lots.reduce((sum, lot) => sum + lot.currentCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Producción</h1>
          <p className="text-sm text-muted-foreground">
            {lots.length} lote{lots.length === 1 ? "" : "s"} activo{lots.length === 1 ? "" : "s"} ·{" "}
            {totalHens} gallinas
          </p>
        </div>
        <NewLotDialog />
      </div>

      <EggForm lots={lots} existing={existing} />

      <div className="space-y-3">
        {lots.length === 0 && (
          <p className="rounded-xl border border-dashed py-10 text-center text-muted-foreground">
            No hay lotes registrados todavía.
          </p>
        )}
        {lots.map((lot) => (
          <LotCard key={lot.id} lot={lot} />
        ))}
      </div>
    </div>
  );
}
