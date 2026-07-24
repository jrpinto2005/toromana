import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCompanySettings } from "@/modules/payments";
import { ProductsPanel } from "./products-panel";
import { SequencesPanel } from "./sequences-panel";
import { CompanyPanel } from "./company-panel";

export const metadata = { title: "Ajustes · Toromana" };
export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  const supabase = await createClient();

  const [{ data: products }, { data: sequences }, company] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, unit, list_price_cop")
      .eq("active", true)
      .order("sort_order"),
    supabase.from("document_sequences").select("name, next_number").order("name"),
    getCompanySettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
        <p className="text-sm text-muted-foreground">
          Precios de lista, consecutivos de recibos y datos de la empresa.
        </p>
      </div>

      <ProductsPanel
        products={(products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit,
          listPriceCop: p.list_price_cop,
        }))}
      />

      <SequencesPanel
        sequences={(sequences ?? []).map((s) => ({ name: s.name, nextNumber: s.next_number }))}
      />

      <CompanyPanel company={company} />
    </div>
  );
}
