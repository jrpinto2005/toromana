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

export type ReceiptItem = {
  productName: string;
  unit: string;
  quantity: number;
  unitPriceCop: number;
  subtotalCop: number;
};

/** Todo lo que necesita la plantilla del recibo — encabezado ya resuelto contra `company_settings`. */
export type Receipt = {
  orderId: string;
  deliveryDate: IsoDate;
  customerName: string;
  customerAddress: string | null;
  customerLegalName: string | null;
  customerNit: string | null;
  customerPoNote: string | null;
  items: ReceiptItem[];
  totalCop: number;
  company: {
    legalName: string;
    taxId: string;
    brandName: string;
    contactBlock: string;
  };
  purchaseOrder: { sequenceName: string; number: number; copies: number } | null;
};
