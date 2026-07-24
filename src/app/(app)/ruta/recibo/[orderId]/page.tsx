import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { getReceipt } from "@/modules/documents";
import { formatCop, formatCopPlain, formatQuantity } from "@/lib/money";
import { formatLongDate } from "@/lib/dates";
import { PrintButton } from "../../imprimir/print-button";

export const dynamic = "force-dynamic";

/**
 * Recibo de entrega — el `RECIBO DE ENTREGA` de siempre, ahora como HTML con
 * `@media print` en vez de PDF generado (ver HANDOFF-B.md: sin
 * `@react-pdf/renderer`). Se imprime con Cmd+P; los institucionales lo
 * imprimen por duplicado según `purchaseOrder.copies`.
 */
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const profile = await getProfile();
  if (!profile) redirect("/login");

  const receipt = await getReceipt(orderId);
  if (!receipt) notFound();

  const copies = receipt.purchaseOrder?.copies ?? 1;

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-black print:p-0">
      <style>{"@media print { header { display: none !important; } }"}</style>

      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-xl font-semibold">Recibo para imprimir</h1>
        <PrintButton />
      </div>

      {Array.from({ length: copies }).map((_, copyIndex) => (
        <article
          key={copyIndex}
          className="break-after-page space-y-6 border-b py-6 first:pt-0 last:border-b-0 print:break-after-page"
        >
          <header className="flex items-start justify-between border-b pb-3">
            <div>
              <h2 className="text-lg font-semibold">{receipt.company.brandName || "Toromana"}</h2>
              {receipt.company.legalName && (
                <p className="text-sm text-neutral-600">{receipt.company.legalName}</p>
              )}
              {receipt.company.taxId && (
                <p className="text-sm text-neutral-600">NIT {receipt.company.taxId}</p>
              )}
              {receipt.company.contactBlock && (
                <p className="whitespace-pre-line text-sm text-neutral-600">
                  {receipt.company.contactBlock}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold uppercase tracking-wide">Recibo de entrega</p>
              {receipt.purchaseOrder && (
                <p className="text-sm text-neutral-600">
                  N.° {receipt.purchaseOrder.number}
                </p>
              )}
              <p className="text-sm text-neutral-600">{formatLongDate(receipt.deliveryDate)}</p>
            </div>
          </header>

          <section className="text-sm">
            <p className="font-medium">{receipt.customerLegalName ?? receipt.customerName}</p>
            {receipt.customerAddress && (
              <p className="text-neutral-600">{receipt.customerAddress}</p>
            )}
            {receipt.customerNit && (
              <p className="text-neutral-600">NIT {receipt.customerNit}</p>
            )}
          </section>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1">Producto</th>
                <th className="py-1 text-right">Cantidad</th>
                <th className="py-1 text-right">Precio unitario</th>
                <th className="py-1 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, index) => (
                <tr key={index} className="border-b">
                  <td className="py-1">{item.productName}</td>
                  <td className="py-1 text-right">
                    {formatQuantity(item.quantity)} {item.unit}
                  </td>
                  <td className="py-1 text-right">{formatCopPlain(item.unitPriceCop)}</td>
                  <td className="py-1 text-right">{formatCopPlain(item.subtotalCop)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-2 text-right font-medium">
                  Total
                </td>
                <td className="pt-2 text-right font-medium">{formatCop(receipt.totalCop)}</td>
              </tr>
            </tfoot>
          </table>

          {receipt.customerPoNote && (
            <p className="rounded-md bg-neutral-100 px-3 py-2 text-xs text-neutral-700">
              {receipt.customerPoNote}
            </p>
          )}

          <div className="flex justify-end pt-8 text-sm">
            <div className="w-56 border-t pt-1 text-center text-neutral-600">Firma recibido</div>
          </div>
        </article>
      ))}
    </div>
  );
}
