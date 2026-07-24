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
  Recurrence,
  StandingItem,
} from './types'

export {
  listCustomers,
  getCustomer,
  getStandingItems,
  getActivePauses,
  listProducts,
  listSellers,
  type CustomerFilter,
  type Product,
  type Seller,
} from './queries'

export {
  createCustomer,
  updateCustomer,
  assignSeller,
  setStandingItems,
  createPause,
  deletePause,
  type CustomerInput,
} from './mutations'
