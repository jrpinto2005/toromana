import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getCompanySettings,
  getCustomerStatement,
  listPaymentHandlers,
} from "@/modules/payments";
import { StatementView } from "./statement-view";

export const dynamic = "force-dynamic";

export default async function CustomerStatementPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  // Se lee directo la fila del cliente en vez de pasar por `modules/clients`
  // porque aquí solo hacen falta tres campos y el módulo es de otro agente.
  const [{ data: customer }, statement, handlers, company] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, kind")
      .eq("id", customerId)
      .maybeSingle(),
    getCustomerStatement(customerId),
    listPaymentHandlers(),
    getCompanySettings(),
  ]);

  if (!customer || !statement) notFound();

  return (
    <div className="space-y-4">
      <Link
        href="/cartera"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Cartera
      </Link>

      <StatementView
        customer={customer}
        statement={statement}
        handlers={handlers}
        currentUserId={profile.id}
        bankDetails={company.bankDetails}
        bankDetailsInstitutional={company.bankDetailsInstitutional}
        isInstitutional={customer.kind === 'institucional'}
        brandName={company.brandName}
      />
    </div>
  );
}
