-- ═══════════════════════════════════════════════════════════════════
-- Proveedores y compras
--
-- El espejo de la cartera: allá se cobra, aquí se debe. Y la compra es
-- además la única entrada legítima de inventario, así que registrarla
-- cumple dos funciones a la vez — por eso las líneas de compra alimentan
-- el libro de movimientos por trigger y no por buena voluntad de quien
-- digita.
-- ═══════════════════════════════════════════════════════════════════

create table suppliers (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  nit        text,
  phone      text,
  contact    text,
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table purchases (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid not null references suppliers(id) on delete restrict,
  purchase_date  date not null default current_date,
  invoice_number text,
  total_cop      integer not null default 0 check (total_cop >= 0),
  note           text,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index purchases_supplier_idx on purchases (supplier_id);

create table purchase_items (
  id            uuid primary key default gen_random_uuid(),
  purchase_id   uuid not null references purchases(id) on delete cascade,
  item_id       uuid not null references inventory_items(id) on delete restrict,
  quantity      numeric(10,2) not null check (quantity > 0),
  unit_cost_cop integer not null check (unit_cost_cop >= 0),
  subtotal_cop  integer generated always as
                  (round(quantity * unit_cost_cop)::integer) stored,
  unique (purchase_id, item_id)
);

create index purchase_items_purchase_idx on purchase_items (purchase_id);

create table supplier_payments (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  purchase_id uuid references purchases(id) on delete set null,
  paid_on     date not null default current_date,
  amount_cop  integer not null check (amount_cop > 0),
  method      payment_method not null default 'transferencia',
  note        text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index supplier_payments_supplier_idx on supplier_payments (supplier_id);

-- Ahora que existe `purchases`, el movimiento de inventario puede apuntar a
-- la compra que lo originó.
alter table inventory_movements
  add constraint inventory_movements_purchase_fk
  foreign key (purchase_id) references purchases(id) on delete cascade;

create unique index inventory_movements_purchase_uq
  on inventory_movements (purchase_id, item_id)
  where reason = 'compra';

-- ─────────────────────────────────────────────────────────────
-- La compra entra al inventario sola
-- ─────────────────────────────────────────────────────────────

/** Reescribe desde cero la entrada de inventario de una compra. */
create or replace function sync_purchase_inventory(p_purchase_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from inventory_movements
   where purchase_id = p_purchase_id and reason = 'compra';

  insert into inventory_movements (item_id, delta, reason, purchase_id, note)
  select item_id, sum(quantity), 'compra', p_purchase_id, 'Compra a proveedor'
    from purchase_items
   where purchase_id = p_purchase_id
   group by item_id
  having sum(quantity) > 0;

  update purchases
     set total_cop = coalesce(
       (select sum(subtotal_cop) from purchase_items where purchase_id = p_purchase_id), 0)
   where id = p_purchase_id;
end $$;

create or replace function purchase_items_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform sync_purchase_inventory(coalesce(new.purchase_id, old.purchase_id));
  return null;
end $$;

create trigger purchase_items_sync_trg
  after insert or update or delete on purchase_items
  for each row execute function purchase_items_sync();

-- ─────────────────────────────────────────────────────────────
-- Lo que se debe, derivado
-- ─────────────────────────────────────────────────────────────

create or replace view v_supplier_debt as
select
  s.id,
  s.name,
  s.active,
  coalesce(c.total, 0)::integer as purchased_cop,
  coalesce(p.total, 0)::integer as paid_cop,
  (coalesce(c.total, 0) - coalesce(p.total, 0))::integer as balance_cop,
  c.last_purchase_on
from suppliers s
left join (
  select supplier_id, sum(total_cop) as total, max(purchase_date) as last_purchase_on
    from purchases group by supplier_id
) c on c.supplier_id = s.id
left join (
  select supplier_id, sum(amount_cop) as total
    from supplier_payments group by supplier_id
) p on p.supplier_id = s.id;

-- ─────────────────────────────────────────────────────────────
-- Seguridad
-- ─────────────────────────────────────────────────────────────

alter table suppliers         enable row level security;
alter table purchases         enable row level security;
alter table purchase_items    enable row level security;
alter table supplier_payments enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'suppliers','purchases','purchase_items','supplier_payments'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      t || '_read', t);
    -- Comprar y pagar proveedores es plata que sale: administración y
    -- contabilidad. Producción registra lo que recibe, no lo que se paga.
    execute format(
      'create policy %I on %I for all to authenticated
         using (auth_role() in (''admin'',''contabilidad''))
         with check (auth_role() in (''admin'',''contabilidad''))',
      t || '_write', t);
  end loop;
end $$;

grant select on v_supplier_debt to authenticated;
grant execute on function sync_purchase_inventory(uuid) to authenticated;
