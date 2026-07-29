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
type ProductRef = { name: string; unit: string; receipt_description?: string | null };

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
/**
 * El reparto de hoy: el confirmado más cercano a la fecha actual.
 *
 * Primero busca hacia adelante —la próxima entrega es lo que le importa a
 * quien reparte— y si no hay ninguna pendiente cae al último despachado.
 *
 * Ordenar por fecha ascendente sin filtrar por hoy devolvía siempre el pedido
 * más viejo de la historia, y la ruta quedaba clavada en él.
 */
export async function getActiveRun(): Promise<DeliveryRunSummary | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: upcoming } = await supabase
    .from("delivery_runs")
    .select("id, delivery_date, status")
    .in("status", ["confirmado", "entregado"])
    .gte("delivery_date", today)
    .order("delivery_date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (upcoming) {
    return { id: upcoming.id, deliveryDate: upcoming.delivery_date, status: upcoming.status };
  }

  const { data: last } = await supabase
    .from("delivery_runs")
    .select("id, delivery_date, status")
    .in("status", ["confirmado", "entregado", "cerrado"])
    .lt("delivery_date", today)
    .order("delivery_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return last ? { id: last.id, deliveryDate: last.delivery_date, status: last.status } : null;
}

/** Semanas despachables, para poder mirar una ruta que no sea la de hoy. */
export async function listDeliverableRuns(): Promise<DeliveryRunSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("delivery_runs")
    .select("id, delivery_date, status")
    .in("status", ["confirmado", "entregado", "cerrado"])
    .order("delivery_date", { ascending: false })
    .limit(20);

  return (data ?? []).map((r) => ({
    id: r.id,
    deliveryDate: r.delivery_date,
    status: r.status,
  }));
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
 * Los pedidos institucionales de una semana, en el orden de la ruta.
 *
 * Son los que se despachan contra un recibo firmado, y quien reparte los
 * necesita todos impresos antes de salir. Uno por uno son cuatro pestañas y
 * cuatro diálogos de impresión; lo que hoy pasa es que alguien se salta el
 * último y la entrega llega sin papel que firmar.
 */
export async function listInstitutionalOrderIds(runId: string): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select("id, route_position, customers!inner(kind)")
    .eq("run_id", runId)
    .eq("customers.kind", "institucional")
    .order("route_position", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`No pude cargar los pedidos institucionales: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id);
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
       order_items(quantity, unit_price_cop, subtotal_cop, products(name, unit, receipt_description))`,
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
        receiptDescription:
          product?.receipt_description ?? product?.name ?? "Producto",
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
