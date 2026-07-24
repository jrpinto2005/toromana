import type { IsoDate } from "@/lib/dates";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type RunStatus = "borrador" | "confirmado" | "entregado" | "cerrado";
export type OrderStatus = "pendiente" | "entregado" | "omitido";

export type DeliveryRunSummary = {
  id: string;
  deliveryDate: IsoDate;
  status: RunStatus;
};

export type RouteItem = {
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
};

export type RouteStop = {
  orderId: string;
  customerId: string;
  customerName: string;
  address: string | null;
  phone: string | null;
  status: OrderStatus;
  totalCop: number;
  note: string | null;
  items: RouteItem[];
};
