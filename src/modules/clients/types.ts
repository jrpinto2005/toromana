export type CustomerKind = 'natural' | 'institucional'
export type Recurrence = 'semanal' | 'quincenal' | 'ocasional'

export type Customer = {
  id: string
  name: string
  address: string | null
  phone: string | null
  sellerId: string | null
  kind: CustomerKind
  recurrence: Recurrence
  biweeklyAnchor: string | null
  requiresPurchaseOrder: boolean
  poCopies: number
  poSequence: string | null
  legalName: string | null
  nit: string | null
  poNote: string | null
  openingBalanceCop: number
  openingBalanceDate: string | null
  notes: string | null
  active: boolean
}

export type StandingItem = {
  productId: string
  productName: string
  quantity: number
}

export type CustomerPause = {
  id: string
  customerId: string
  startsOn: string
  endsOn: string
  reason: string | null
}

export type CustomerRow = {
  id: string
  name: string
  address: string | null
  phone: string | null
  seller_id: string | null
  kind: CustomerKind
  recurrence: Recurrence
  biweekly_anchor: string | null
  requires_purchase_order: boolean
  po_copies: number
  po_sequence: string | null
  legal_name: string | null
  nit: string | null
  po_note: string | null
  opening_balance_cop: number
  opening_balance_date: string | null
  notes: string | null
  active: boolean
}

export const CUSTOMER_COLUMNS =
  'id, name, address, phone, seller_id, kind, recurrence, biweekly_anchor, ' +
  'requires_purchase_order, po_copies, po_sequence, legal_name, nit, po_note, ' +
  'opening_balance_cop, opening_balance_date, notes, active'

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    sellerId: row.seller_id,
    kind: row.kind,
    recurrence: row.recurrence,
    biweeklyAnchor: row.biweekly_anchor,
    requiresPurchaseOrder: row.requires_purchase_order,
    poCopies: row.po_copies,
    poSequence: row.po_sequence,
    legalName: row.legal_name,
    nit: row.nit,
    poNote: row.po_note,
    openingBalanceCop: row.opening_balance_cop,
    openingBalanceDate: row.opening_balance_date,
    notes: row.notes,
    active: row.active,
  }
}

export type Product = {
  id: string
  name: string
  unit: string
  listPriceCop: number
}

export type Seller = { id: string; fullName: string }
