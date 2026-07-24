/**
 * Módulo de pedidos — API pública.
 *
 * ⚠️ Solo desde componentes de servidor. Los componentes 'use client' importan
 * sus tipos de `@/modules/orders/types`.
 */

export type {
  DeliveryRun,
  Order,
  OrderItem,
  OrderStatus,
  PausedCustomer,
  RunDetail,
  RunStatus,
  RunSummary,
} from './types'

export { listRuns, getRun, getRunDetail, getPausedFor, getLastPrices } from './queries'

export {
  createRun,
  addCustomerToRun,
  removeOrder,
  setOrderItem,
  confirmRun,
  markDelivered,
  deleteRun,
  type GenerationResult,
} from './mutations'
