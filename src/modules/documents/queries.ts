import { createClient } from "@/lib/supabase/server";
import type { DeliveryRunSummary, RouteStop } from "./types";

type CustomerRef = { id: string; name: string; address: string | null; phone: string | null };
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
