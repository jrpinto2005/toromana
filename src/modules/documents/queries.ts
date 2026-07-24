import { createClient } from "@/lib/supabase/server";
import type { DeliveryRunSummary, Receipt, RouteStop } from "./types";

type CustomerRef = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  legal_name?: string | null;
  nit?: string | null;
  po_note?: string | null;
};
type ProductRef = { name: string; unit: string };

/** Supabase entrega relaciones anidadas como objeto o arreglo según el join. */
function one<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * La ruta del día: primero el próximo pedido confirmado (el que hay que
 * entregar), y si no hay ninguno pendiente, el último ya entregado —útil para
 * revisar qué pasó sin tener que ir a buscar el run por id.
 */
export async function getActiveRun(): Promise<DeliveryRunSummary | null> {
  const supabase = await createClient();

  const { data: upcoming } = await supabase
    .from("delivery_runs")
    .select("id, delivery_date, status")
    .eq("status", "confirmado")
    .order("delivery_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (upcoming) {
    return { id: upcoming.id, deliveryDate: upcoming.delivery_date, status: upcoming.status };
  }

  const { data: last } = await supabase
    .from("delivery_runs")
    .select("id, delivery_date, status")
    .eq("status", "entregado")
    .order("delivery_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return last ? { id: last.id, deliveryDate: last.delivery_date, status: last.status } : null;
}

export async function getRun(runId: string): Promise<DeliveryRunSummary | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_runs")
    .select("id, delivery_date, status")
    .eq("id", runId)
    .maybeSingle();

  return data ? { id: data.id, deliveryDate: data.delivery_date, status: data.status } : null;
}

/** Las paradas de un run, con cliente y productos ya resueltos para pintar la lista. */
export async function getRouteStops(runId: string): Promise<RouteStop[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, customer_id, status, total_cop, note, route_position,
       customer:customers(id, name, address, phone),
       order_items(product_id, quantity, products(name, unit))`,
    )
    .eq("run_id", runId)
    .order("route_position", { ascending: true, nullsFirst: false });

  if (error) throw new Error(`No pude cargar la ruta: ${error.message}`);

  return (data ?? []).map((row) => {
    const customer = one(row.customer as unknown as CustomerRef | CustomerRef[]);
    const items = (row.order_items ?? []) as Array<{
      product_id: string;
      quantity: number;
      products: ProductRef | ProductRef[] | null;
    }>;

    return {
      orderId: row.id,
      customerId: row.customer_id,
      customerName: customer?.name ?? "Cliente",
      address: customer?.address ?? null,
      phone: customer?.phone ?? null,
      status: row.status,
      totalCop: row.total_cop,
      note: row.note,
      items: items.map((item) => {
        const product = one(item.products);
        return {
          productId: item.product_id,
          productName: product?.name ?? "Producto",
          unit: product?.unit ?? "",
          quantity: Number(item.quantity),
        };
      }),
    };
  });
}

/**
 * Datos completos para imprimir un recibo: pedido, cliente, empresa y el
 * consecutivo ya generado si lo hay. No genera el número aquí — eso lo hace
 * `generatePurchaseOrdersForRun` una sola vez, al confirmar.
 */
export async function getReceipt(orderId: string): Promise<Receipt | null> {
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      `id, total_cop, run:delivery_runs(delivery_date),
       customer:customers(name, address, legal_name, nit, po_note),
       order_items(quantity, unit_price_cop, subtotal_cop, products(name, unit))`,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const customer = one(order.customer as unknown as CustomerRef | CustomerRef[]);
  const run = one(order.run as unknown as { delivery_date: string } | { delivery_date: string }[]);
  const items = (order.order_items ?? []) as Array<{
    quantity: number;
    unit_price_cop: number;
    subtotal_cop: number;
    products: ProductRef | ProductRef[] | null;
  }>;

  const [{ data: company }, { data: po }] = await Promise.all([
    supabase
      .from("company_settings")
      .select("legal_name, tax_id, brand_name, contact_block")
      .maybeSingle(),
    supabase
      .from("purchase_orders")
      .select("sequence_name, number, copies")
      .eq("order_id", orderId)
      .maybeSingle(),
  ]);

  return {
    orderId: order.id,
    deliveryDate: run?.delivery_date ?? "",
    customerName: customer?.name ?? "Cliente",
    customerAddress: customer?.address ?? null,
    customerLegalName: customer?.legal_name ?? null,
    customerNit: customer?.nit ?? null,
    customerPoNote: customer?.po_note ?? null,
    items: items.map((item) => {
      const product = one(item.products);
      return {
        productName: product?.name ?? "Producto",
        unit: product?.unit ?? "",
        quantity: Number(item.quantity),
        unitPriceCop: item.unit_price_cop,
        subtotalCop: item.subtotal_cop,
      };
    }),
    totalCop: order.total_cop,
    company: {
      legalName: company?.legal_name ?? "",
      taxId: company?.tax_id ?? "",
      brandName: company?.brand_name ?? "",
      contactBlock: company?.contact_block ?? "",
    },
    purchaseOrder: po
      ? { sequenceName: po.sequence_name, number: po.number, copies: po.copies }
      : null,
  };
}
