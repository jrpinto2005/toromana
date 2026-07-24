# Toromana — Arquitectura

## 1. Decisión: monolito modular, no microservicios

El negocio pidió microservicios por una razón válida: **flexibilidad futura**. Se le van
a ocurrir necesidades nuevas y no quiere quedar preso de un diseño rígido.

Pero microservicios no son la fuente de esa flexibilidad — las **fronteras limpias** lo son.
Un monolito con módulos bien separados da exactamente la misma capacidad de evolución, sin
pagar hoy el costo de contratos HTTP, colas, migraciones múltiples y debugging distribuido.

**Lo que sí adoptamos de microservicios (la parte que importa):**
- Un módulo por dominio, con su propia carpeta y sus propias tablas
- Los módulos **nunca** importan internals de otro módulo — solo su API pública (`index.ts`)
- Toda lógica de negocio vive en el módulo, no en los componentes de UI
- Los efectos externos (PDF, WhatsApp, Excel) están detrás de interfaces

**La regla que hace esto real:** si el día de mañana `production/` debe volverse un servicio
aparte, se mueve la carpeta a su repo, se convierten las llamadas a su `index.ts` en llamadas
HTTP, y nada más se toca. Si esa operación requiere tocar otros módulos, la frontera estaba mal.

## 2. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js 15** (App Router) + TypeScript | Un solo deploy para UI y backend |
| BD | **Supabase** (Postgres) | Postgres real, no un ORM propietario |
| Auth | **Supabase Auth** | 4 usuarios sembrados, signup cerrado |
| Colaboración | **Supabase Realtime** | Los 3 vendedores editando el mismo pedido, gratis |
| UI | Tailwind + shadcn/ui | Componentes buenos sin diseñar desde cero |
| PDF | `@react-pdf/renderer` | Recibos y ruta de reparto |
| Excel | `xlsx` (SheetJS) | Importar el `.xlsm`, exportar la ruta |
| Deploy | **Vercel** + Supabase | Ambos free tier |

**Costo mensual: $0** hasta 500 MB de BD y 50k usuarios activos. Un negocio de ~150 clientes
y ~40 pedidos semanales no se acerca ni de lejos a esos límites. La primera factura llegaría
en años, no en meses.

## 3. Estructura de carpetas

```
src/
├── app/                          # Rutas Next.js — solo UI y orquestación
│   ├── (auth)/login/
│   ├── (app)/
│   │   ├── pedidos/[runId]/      # Pedido semanal colaborativo
│   │   ├── clientes/
│   │   ├── cartera/              # Panel de cobros con urgencia
│   │   ├── produccion/           # lotes de gallinas
│   │   ├── analitica/            # métricas de producción y clientes
│   │   ├── ajustes/              # Precios, consecutivos, usuarios
│   │   └── ruta/                 # Vista móvil de Reparto
│   └── api/
├── modules/                      # ← toda la lógica de negocio
│   ├── clients/
│   │   ├── index.ts              # API pública del módulo
│   │   ├── queries.ts
│   │   ├── mutations.ts
│   │   └── types.ts
│   ├── orders/                   # generación, edición, confirmación
│   ├── payments/                 # pagos, FIFO, cartera
│   ├── production/               # lotes, huevos, tasa de postura
│   ├── documents/                # PDFs, consecutivos, exports
│   ├── notifications/            # urgencia, plantillas WhatsApp
│   └── import/                   # ingesta del .xlsm
├── lib/
│   ├── supabase/                 # clientes server y browser
│   ├── dates.ts                  # próximo lunes (sugerencia), formateo
│   └── money.ts                  # COP, sin decimales
supabase/
└── migrations/
```

## 4. Esquema de base de datos

```sql
-- ═══════════════════════════════════════════════════════════
-- Usuarios y catálogos
-- ═══════════════════════════════════════════════════════════

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
  unit           text not null,              -- 'libra', 'cubeta de 30', 'unidad'
  list_price_cop integer not null,
  sort_order     integer not null default 0,
  active         boolean not null default true
);

-- ═══════════════════════════════════════════════════════════
-- Clientes
-- ═══════════════════════════════════════════════════════════

create type customer_kind  as enum ('natural','institucional');
create type recurrence_t   as enum ('semanal','quincenal','ocasional');

create table customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  phone       text,
  seller_id   uuid references profiles(id),
  kind        customer_kind not null default 'natural',
  recurrence  recurrence_t  not null default 'ocasional',

  -- para 'quincenal': ancla desde la que se cuentan las quincenas
  biweekly_anchor date,

  -- órdenes de compra
  requires_purchase_order boolean not null default false,
  po_copies   smallint not null default 1,      -- institucionales: 2
  po_sequence text,                             -- 'general' | 'institucional_b'
  legal_name  text,                             -- razón social del cliente
  nit         text,                             -- opcional: Institucional C no tiene
  po_note     text,                             -- cláusula de comodato de Institucional B

  -- cartera heredada del Excel
  opening_balance_cop  integer not null default 0,
  opening_balance_date date,

  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index on customers (seller_id);

-- El "pedido fijo": reemplaza la hoja `Fijos`
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
  created_by  uuid references profiles(id),
  check (ends_on >= starts_on)
);

-- ═══════════════════════════════════════════════════════════
-- Pedido semanal
-- ═══════════════════════════════════════════════════════════

create type run_status   as enum ('borrador','confirmado','entregado','cerrado');
create type order_status as enum ('pendiente','entregado','omitido');

create table delivery_runs (
  id            uuid primary key default gen_random_uuid(),
  delivery_date date not null unique,
  status        run_status not null default 'borrador',
  notes         text,
  created_by    uuid references profiles(id),
  confirmed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table orders (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references delivery_runs on delete cascade,
  customer_id    uuid not null references customers,
  seller_id      uuid references profiles(id),   -- snapshot: el vendedor puede cambiar después
  status         order_status not null default 'pendiente',
  route_position integer,
  source         text not null default 'auto',   -- 'auto' | 'manual'
  added_by       uuid references profiles(id),
  delivered_at   timestamptz,
  delivered_by   uuid references profiles(id),
  note           text,
  total_cop      integer not null default 0,
  created_at     timestamptz not null default now()
);

create index on orders (run_id);
create index on orders (customer_id);

-- Un cliente no puede estar dos veces en el mismo pedido. En el Excel real pasa
-- (`un cliente`, hoja `Julio 22`) pero fue un error de digitación, no un
-- caso de negocio. La base lo impide en vez de perpetuarlo.
alter table orders add constraint orders_run_customer_unique
  unique (run_id, customer_id);

create table order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references orders on delete cascade,
  product_id     uuid not null references products,
  quantity       numeric(10,2) not null check (quantity > 0),  -- admite 0.5 y 0.75
  unit_price_cop integer not null,                             -- congelado al confirmar
  subtotal_cop   integer generated always as
                   (round(quantity * unit_price_cop)::integer) stored
);

create index on order_items (order_id);

-- ═══════════════════════════════════════════════════════════
-- Pagos y cartera
-- ═══════════════════════════════════════════════════════════

create type payment_method as enum ('efectivo','transferencia');
create type payment_status as enum ('confirmado','por_confirmar');

create table payments (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers,
  amount_cop     integer not null check (amount_cop > 0),
  method         payment_method not null,
  paid_at        date not null default current_date,
  received_by    uuid references profiles(id),   -- quién recibió la plata
  receipt_holder uuid references profiles(id),   -- quién tiene el comprobante (transferencia)
  status         payment_status not null default 'confirmado',
  reported_by    uuid references profiles(id),   -- Reparto, cuando reporta efectivo
  confirmed_by   uuid references profiles(id),   -- Contabilidad
  confirmed_at   timestamptz,
  order_id       uuid references orders(id),     -- si nace de una entrega puntual
  note           text,
  created_at     timestamptz not null default now()
);

create index on payments (customer_id);

-- ═══════════════════════════════════════════════════════════
-- Documentos
-- ═══════════════════════════════════════════════════════════

create table document_sequences (
  name        text primary key,      -- 'general', 'institucional_b'
  next_number integer not null
);

create table purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders on delete cascade,
  sequence_name text not null references document_sequences(name),
  number        integer not null,
  issue_date    date not null,
  copies        smallint not null default 1,
  created_at    timestamptz not null default now(),
  unique (sequence_name, number)     -- garantiza que nunca se repiten
);

create or replace function next_document_number(seq text)
returns integer language plpgsql as $$
declare n integer;
begin
  update document_sequences
     set next_number = next_number + 1
   where name = seq
  returning next_number - 1 into n;
  if n is null then raise exception 'Secuencia % no existe', seq; end if;
  return n;
end $$;

-- ═══════════════════════════════════════════════════════════
-- Producción
-- ═══════════════════════════════════════════════════════════

create type lot_event_type as enum ('mortalidad','venta','ingreso','descarte');

create table hen_lots (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  entry_date    date not null,
  initial_count integer not null check (initial_count >= 0),
  breed         text,
  notes         text,
  active        boolean not null default true
);

create table hen_lot_events (
  id         uuid primary key default gen_random_uuid(),
  lot_id     uuid not null references hen_lots on delete cascade,
  event_date date not null,
  type       lot_event_type not null,
  quantity   integer not null check (quantity > 0),
  note       text,
  created_by uuid references profiles(id)
);

create table egg_production (
  id         uuid primary key default gen_random_uuid(),
  lot_id     uuid references hen_lots on delete cascade,
  week_start date not null,
  eggs       integer not null check (eggs >= 0),
  note       text,
  created_by uuid references profiles(id),
  unique (lot_id, week_start)
);
```

### 4.1 Vistas — cartera FIFO

El saldo no se guarda: se **deriva**. Un saldo almacenado se desincroniza; uno derivado
no puede mentir.

```sql
-- Todo lo que se le ha cobrado a un cliente, en orden cronológico
create or replace view v_charges as
  select id as customer_id, opening_balance_date as charge_date, opening_balance_cop as amount
    from customers
   where opening_balance_cop > 0 and opening_balance_date is not null
  union all
  select o.customer_id, r.delivery_date, o.total_cop
    from orders o
    join delivery_runs r on r.id = o.run_id
   where r.status in ('confirmado','entregado','cerrado')
     and o.status <> 'omitido'
     and o.total_cop > 0;

create or replace view v_customer_balance as
  select cu.id as customer_id,
         coalesce(ch.total, 0) as charged_cop,
         coalesce(pa.total, 0) as paid_cop,
         coalesce(ch.total, 0) - coalesce(pa.total, 0) as balance_cop
    from customers cu
    left join (select customer_id, sum(amount)     as total from v_charges group by 1) ch
           on ch.customer_id = cu.id
    left join (select customer_id, sum(amount_cop) as total from payments
                where status = 'confirmado' group by 1) pa
           on pa.customer_id = cu.id;

-- FIFO: la deuda más antigua que los pagos aún no alcanzan a cubrir
create or replace view v_customer_debt as
  select b.*,
         d.oldest_unpaid_date,
         case when b.balance_cop <= 0 or d.oldest_unpaid_date is null then 0
              else current_date - d.oldest_unpaid_date end as days_overdue
    from v_customer_balance b
    left join lateral (
      select min(r.charge_date) as oldest_unpaid_date
        from (select ch.charge_date,
                     sum(ch.amount) over (order by ch.charge_date
                                          rows between unbounded preceding and current row) as cum
                from v_charges ch
               where ch.customer_id = b.customer_id) r
       where r.cum > b.paid_cop
    ) d on true;
```

El nivel de urgencia (🟢🟡🟠🔴⚫) se calcula sobre `days_overdue` en el módulo
`notifications`, no en SQL — es una regla de negocio y va a cambiar.

### 4.2 Vista — producción

```sql
create or replace view v_hen_lot_status as
  select l.*,
         l.initial_count
           - coalesce(sum(e.quantity) filter (where e.type in
               ('mortalidad','venta','descarte')), 0)
           + coalesce(sum(e.quantity) filter (where e.type = 'ingreso'), 0)
           as current_count
    from hen_lots l
    left join hen_lot_events e on e.lot_id = l.id
   group by l.id;
```

**Tasa de postura** = `eggs / (current_count × 7)` por semana. Es *la* métrica del
negocio y sale de dividir dos columnas que ya existen.

## 5. Seguridad (RLS)

Con 4 usuarios que se conocen y se hablan a diario, la seguridad protege del
**internet**, no de ellos entre sí. Políticas pragmáticas:

- **Lectura**: cualquier usuario autenticado lee todo. Los vendedores *necesitan* ver los
  clientes de los otros — es literalmente el problema que vinimos a resolver.
- **Escritura en `payments`**: `admin` y `contabilidad` insertan `confirmado`;
  `reparto` solo inserta `por_confirmar` y nunca actualiza.
- **Escritura en producción**: `admin` y `produccion`.
- **Escritura en `products`, `document_sequences`, `profiles`**: solo `admin`.
- **Signup cerrado** en Supabase Auth. Los 4 usuarios se siembran a mano.

## 6. Fecha de entrega

**La fecha se ingresa a mano.** El date picker viene pre-llenado con el próximo lunes,
que es el caso normal, y quien crea el pedido lo cambia cuando hay festivo u otra razón.

Se evaluó calcular los festivos colombianos (Ley Emiliani) para mover la fecha solo,
y se descartó: es código que puede equivocarse en silencio para ahorrar dos clics al mes.
Quien arma el pedido sabe perfectamente cuándo hay festivo.

## 7. Colaboración en tiempo real

Suscripción de Supabase Realtime a `postgres_changes` sobre `orders` y `order_items`
filtrada por `run_id`. Cuando Producción agrega un cliente, aparece en la pantalla de
Admin sin refrescar.

Resolución de conflictos: **último en escribir gana**, a nivel de campo. Con 3 personas
que además se están hablando por teléfono, cualquier cosa más sofisticada es sobreingeniería.

## 8. Camino a microservicios (cuando se justifique)

El orden natural de extracción, por acoplamiento de menor a mayor:

1. **`production`** — es el más independiente. Solo comparte `profiles`.
2. **`documents`** — generación de PDFs; puede vivir como worker aparte.
3. **`notifications`** — al conectar la WhatsApp Cloud API, se vuelve un servicio con cola.
4. **`clients` + `orders` + `payments`** — estos tres se quedan juntos. Comparten
   transacciones y separarlos exige consistencia eventual. No se tocan hasta que haya
   una razón real.

Mientras cada módulo solo se hable con los otros por su `index.ts`, cada uno de estos
pasos es una tarde de trabajo, no una reescritura.
