export type RunStatus = 'borrador' | 'confirmado' | 'entregado' | 'cerrado'
export type OrderStatus = 'pendiente' | 'entregado' | 'omitido'

export type DeliveryRun = {
  id: string
  deliveryDate: string
  status: RunStatus
  notes: string | null
  confirmedAt: string | null
}

export type OrderItem = {
  id: string
  productId: string
  productName: string
  unit: string
  quantity: number
  unitPriceCop: number
  subtotalCop: number
  /** Precio de lista vigente, para avisar cuando la línea va a otro precio. */
  listPriceCop: number
}

export type Order = {
  id: string
  runId: string
  customerId: string
  customerName: string
  customerAddress: string | null
  sellerId: string | null
  status: OrderStatus
  source: 'auto' | 'manual'
  note: string | null
  totalCop: number
  items: OrderItem[]
}

/**
 * Cliente que habría entrado al pedido pero está en pausa.
 *
 * Se muestra en gris con el motivo en vez de desaparecer: que un cliente no esté
 * esta semana tiene que ser una decisión visible, no un silencio. Que alguien se
 * caiga de la lista sin que nadie lo note es el error que hoy sale más caro.
 */
export type PausedCustomer = {
  customerId: string
  customerName: string
  reason: string | null
  endsOn: string
}

export type RunDetail = {
  run: DeliveryRun
  orders: Order[]
  paused: PausedCustomer[]
}

export type RunSummary = DeliveryRun & {
  orderCount: number
  totalCop: number
}
