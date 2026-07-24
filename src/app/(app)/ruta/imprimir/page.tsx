import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getActiveRun, getRouteStops } from "@/modules/documents";
import { formatCop } from "@/lib/money";
import { formatWeekdayDate } from "@/lib/dates";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

/**
 * Lista de reparto en HTML puro con `@media print`. Se imprime con Cmd+P y se
 * guarda como PDF desde el navegador — sin `@react-pdf/renderer` (ver
 * HANDOFF-B.md).
 */
export default async function PrintRoutePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const run = await getActiveRun();
  if (!run) notFound();

  const stops = await getRouteStops(run.id);

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-black print:p-0">
      {/* El header y la nav vienen del layout de A: no se pueden editar desde
          aquí, así que se ocultan al imprimir con una regla global acotada a
          esta página. */}
      <style>{"@media print { header { display: none !important; } }"}</style>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Ruta para imprimir</h1>
        <PrintButton />
      </div>

      <header className="mb-6 border-b pb-3">
        <h1 className="text-lg font-semibold">Ruta de reparto</h1>
        <p className="text-sm text-neutral-600">{formatWeekdayDate(run.deliveryDate)}</p>
      </header>

      <ol className="space-y-4">
        {stops.map((stop, index) => (
          <li key={stop.orderId} className="break-inside-avoid border-b pb-3 text-sm">
            <div className="flex items-baseline justify-between font-medium">
              <span>
                {index + 1}. {stop.customerName}
              </span>
              <span>{formatCop(stop.totalCop)}</span>
            </div>
            {stop.address && <p className="text-neutral-600">{stop.address}</p>}
            {stop.phone && <p className="text-neutral-600">{stop.phone}</p>}
            <ul className="mt-1 list-disc pl-5 text-neutral-700">
              {stop.items.map((item) => (
                <li key={item.productId}>
                  {item.quantity} {item.unit} de {item.productName}
                </li>
              ))}
            </ul>
            {stop.note && <p className="mt-1 italic text-neutral-500">{stop.note}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
