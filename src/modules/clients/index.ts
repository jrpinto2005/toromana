/**
 * Módulo de clientes — API pública.
 *
 * Los demás módulos importan SOLO desde aquí, nunca de queries.ts o mutations.ts.
 * Esa es la frontera que permitiría extraer este módulo a un servicio aparte sin
 * tocar a nadie más.
 */

export type {
  Customer,
  CustomerKind,
  CustomerPause,
  Product,
  Recurrence,
  Seller,
  StandingItem,
} from './types'

export {
  listCustomers,
  getCustomer,
  getStandingItems,
  getAllStandingItems,
  getActivePauses,
  listProducts,
  listSellers,
  type CustomerFilter,
} from './queries'

export {
  createCustomer,
  updateCustomer,
  assignSeller,
  setStandingItems,
  setStandingItem,
  setRecurrence,
  createPause,
  deletePause,
  type CustomerInput,
} from './mutations'
