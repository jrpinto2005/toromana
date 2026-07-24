-- ═══════════════════════════════════════════════════════════════════
-- Toromana — esquema inicial
-- Ver docs/ARCHITECTURE.md sección 4 para el razonamiento detrás de cada tabla.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Usuarios y catálogos
-- ─────────────────────────────────────────────────────────────

create type user_role as enum ('admin','contabilidad','produccion','reparto');

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null,
  role        user_role not null,
  is_seller   boolean not null default false,
  phone       text,
  created_at  timestamptz not null default now()
);

create table products (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  unit           text not null,
  list_price_cop integer not null check (list_price_cop >= 0),
  sort_order     integer not null default 0,
  active         boolean not null default true
);

-- Datos de la empresa para el encabezado de los recibos.
-- Van en base de datos, no en el código: el repositorio es público.
create table company_settings (
  id            boolean primary key default true check (id),
  legal_name    text not null default '',
  tax_id        text not null default '',
  brand_name    text not null default '',
  contact_block text not null default '',   -- teléfonos y correos, texto libre
  bank_details  text not null default ''    -- se cita en los mensajes de cobro
);

insert into company_settings (id) values (true);

-- ─────────────────────────────────────────────────────────────
-- Clientes
-- ─────────────────────────────────────────────────────────────

create type customer_kind as enum ('natural','institucional');
create type recurrence_t  as enum ('semanal','quincenal','ocasional');

create table customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  phone       text,
  seller_id   uuid references profiles(id) on delete set null,
  kind        customer_kind not null default 'natural',
  recurrence  recurrence_t  not null default 'ocasional',

  -- para 'quincenal': fecha desde la que se cuentan las quincenas
  biweekly_anchor date,

  -- órdenes de compra
  requires_purchase_order boolean not null default false,
  po_copies   smallint not null default 1 check (po_copies between 1 and 4),
  po_sequence text,
  legal_name  text,
  nit         text,
  po_note     text,

  -- cartera heredada del Excel
  opening_balance_cop  integer not null default 0,
  opening_balance_date date,

  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),

  -- si arrastra saldo, tiene que saberse desde cuándo, o el FIFO no puede fecharlo
  constraint opening_balance_needs_date
    check (opening_balance_cop = 0 or opening_balance_date is not null)
);

create index customers_seller_idx on customers (seller_id);
create index customers_active_idx on customers (active);

-- El "pedido fijo": reemplaza la hoja `Fijos` del Excel
create table standing_order_items (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers on delete cascade,
  product_id  uuid not null references products,
  quantity    numeric(10,2) not null check (quantity > 0),
  unique (customer_id, product_id)
);

-- "No me manden del 15 al 30"
create table customer_pauses (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers on delete cascade,
  starts_on   date not null,
  ends_on     date not null,
  reason      text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index customer_pauses_customer_idx on customer_pauses (customer_id);

-- ─────────────────────────────────────────────────────────────
-- Pedido semanal
-- ─────────────────────────────────────────────────────────────

create type run_status   as enum ('borrador','confirmado','entregado','cerrado');
create type order_status as enum ('pendiente','entregado','omitido');

create table delivery_runs (
  id            uuid primary key default gen_random_uuid(),
  delivery_date date not null unique,
  status        run_status not null default 'borrador',
  notes         text,
  created_by    uuid references profiles(id) on delete set null,
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table orders (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references delivery_runs on delete cascade,
  customer_id    uuid not null references customers,
  seller_id      uuid references profiles(id) on delete set null,
  status         order_status not null default 'pendiente',
  route_position integer,
  source         text not null default 'auto' check (source in ('auto','manual')),
  added_by       uuid references profiles(id) on delete set null,
  delivered_at   timestamptz,
  delivered_by   uuid references profiles(id) on delete set null,
  note           text,
  total_cop      integer not null default 0,
  created_at     timestamptz not null default now(),

  -- Un cliente no puede estar dos veces en el mismo pedido. En el Excel real pasa,
  -- pero fue un error de digitación, no un caso de negocio.
  unique (run_id, customer_id)
);

create index orders_run_idx      on orders (run_id);
create index orders_customer_idx on orders (customer_id);

create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders on delete cascade,
  product_id     uuid not null references products,
  quantity       numeric(10,2) not null check (quantity > 0),  -- admite 0.5 y 0.75
  unit_price_cop integer not null check (unit_price_cop >= 0), -- congelado al confirmar
  subtotal_cop   integer generated always as
                   (round(quantity * unit_price_cop)::integer) stored,
  unique (order_id, product_id)
);

create index order_items_order_idx on order_items (order_id);

-- ─────────────────────────────────────────────────────────────
-- Pagos
-- ─────────────────────────────────────────────────────────────

create type payment_method as enum ('efectivo','transferencia');
create type payment_status as enum ('confirmado','por_confirmar');

create table payments (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers,
  amount_cop     integer not null check (amount_cop > 0),
  method         payment_method not null,
  paid_at        date not null default current_date,
  received_by    uuid references profiles(id) on delete set null,
  receipt_holder uuid references profiles(id) on delete set null,
  status         payment_status not null default 'confirmado',
  reported_by    uuid references profiles(id) on delete set null,
  confirmed_by   uuid references profiles(id) on delete set null,
  confirmed_at   timestamptz,
  order_id       uuid references orders(id) on delete set null,
  note           text,
  created_at     timestamptz not null default now(),

  -- el comprobante solo tiene sentido en transferencias
  constraint receipt_holder_only_for_transfers
    check (receipt_holder is null or method = 'transferencia')
);

create index payments_customer_idx on payments (customer_id);
create index payments_status_idx   on payments (status);

-- ─────────────────────────────────────────────────────────────
-- Documentos
-- ─────────────────────────────────────────────────────────────

create table document_sequences (
  name        text primary key,
  next_number integer not null check (next_number > 0)
);

create table purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders on delete cascade,
  sequence_name text not null references document_sequences(name),
  number        integer not null,
  issue_date    date not null,
  copies        smallint not null default 1,
  created_at    timestamptz not null default now(),
  unique (sequence_name, number)
);

-- Avanza el consecutivo de forma atómica. Nunca leer y escribir el contador a mano:
-- dos vendedores confirmando al tiempo generarían el mismo número.
create or replace function next_document_number(seq text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update document_sequences
     set next_number = next_number + 1
   where name = seq
  returning next_number - 1 into n;

  if n is null then
    raise exception 'La secuencia % no existe', seq;
  end if;

  return n;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Producción
-- ─────────────────────────────────────────────────────────────

create type lot_event_type as enum ('mortalidad','venta','ingreso','descarte');

create table hen_lots (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  entry_date    date not null,
  initial_count integer not null check (initial_count >= 0),
  breed         text,
  notes         text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table hen_lot_events (
  id         uuid primary key default gen_random_uuid(),
  lot_id     uuid not null references hen_lots on delete cascade,
  event_date date not null,
  type       lot_event_type not null,
  quantity   integer not null check (quantity > 0),
  note       text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index hen_lot_events_lot_idx on hen_lot_events (lot_id);

create table egg_production (
  id         uuid primary key default gen_random_uuid(),
  lot_id     uuid references hen_lots on delete cascade,
  week_start date not null,
  eggs       integer not null check (eggs >= 0),
  note       text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (lot_id, week_start)
);
