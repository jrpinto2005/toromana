-- ═══════════════════════════════════════════════════════════════════
-- Inventario — miel, mermelada y cartones
--
-- El stock NO se guarda como un número: se deriva sumando el libro de
-- movimientos, igual que la cartera se deriva de las vistas FIFO. Un saldo
-- almacenado se desincroniza en el primer error de digitación y nadie se
-- entera hasta que falta producto un lunes a las 5 a.m.; uno derivado no
-- puede mentir.
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Qué se cuenta
-- ─────────────────────────────────────────────────────────────

-- 'producto' se vende y se cuenta (miel, mermelada). 'insumo' solo se
-- consume: el cliente nunca compra un cartón, pero sin cartones no sale
-- una sola cubeta.
create type inventory_kind as enum ('producto','insumo');

create table inventory_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  unit          text not null,
  kind          inventory_kind not null default 'producto',

  -- Punto de reposición: por debajo de aquí el sistema avisa. En 0 no avisa
  -- nunca, que es el default deliberado — un aviso que nadie configuró es
  -- un aviso que se ignora.
  reorder_point numeric(10,2) not null default 0 check (reorder_point >= 0),

  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Cuánto insumo se lleva cada unidad vendida de un producto.
--
-- Es la tabla que traduce "vendimos 14 cubetas" a "se fueron 28 cartones".
-- Va en base de datos y no en el código porque la relación cambia cuando
-- cambia el empaque, y eso no debería requerir un despliegue.
create table inventory_consumption (
  product_id   uuid not null references products(id) on delete cascade,
  item_id      uuid not null references inventory_items(id) on delete cascade,
  qty_per_unit numeric(10,2) not null check (qty_per_unit > 0),
  primary key (product_id, item_id)
);

-- ─────────────────────────────────────────────────────────────
-- El libro de movimientos
-- ─────────────────────────────────────────────────────────────

create type inventory_reason as enum ('inicial','compra','venta','ajuste','merma');

create table inventory_movements (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references inventory_items(id) on delete cascade,

  -- Positivo entra, negativo sale. Sin excepciones: un ajuste que corrige
  -- hacia abajo es un delta negativo, no un campo aparte.
  delta       numeric(10,2) not null check (delta <> 0),
  reason      inventory_reason not null,

  -- Trazabilidad hacia lo que causó el movimiento.
  run_id      uuid references delivery_runs(id) on delete cascade,
  purchase_id uuid,  -- la llave foránea se agrega en 0015, con la tabla

  note        text,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index inventory_movements_item_idx on inventory_movements (item_id);
create index inventory_movements_run_idx  on inventory_movements (run_id);

-- Un solo movimiento de venta por semana y por insumo. Es lo que permite
-- recalcular sin duplicar: confirmar dos veces el mismo pedido —o editarlo
-- después de confirmado, que es lo normal aquí— reescribe la fila en vez
-- de agregar otra.
create unique index inventory_movements_run_sale_uq
  on inventory_movements (run_id, item_id)
  where reason = 'venta';

-- ─────────────────────────────────────────────────────────────
-- Stock derivado
-- ─────────────────────────────────────────────────────────────

create or replace view v_inventory_stock as
select
  i.id,
  i.name,
  i.unit,
  i.kind,
  i.reorder_point,
  i.sort_order,
  i.active,
  coalesce(sum(m.delta), 0)::numeric(10,2) as stock,
  -- El aviso se calcula aquí y no en la aplicación: así el correo automático
  -- y la pantalla no pueden discrepar sobre qué está escaso.
  (i.reorder_point > 0 and coalesce(sum(m.delta), 0) <= i.reorder_point)
    as below_reorder
from inventory_items i
left join inventory_movements m on m.item_id = i.id
group by i.id;

-- ─────────────────────────────────────────────────────────────
-- Descuento por venta
-- ─────────────────────────────────────────────────────────────

/**
 * Recalcula el consumo de una semana desde cero.
 *
 * Borra los movimientos de venta del run y los vuelve a escribir a partir de
 * las líneas actuales. Es idempotente a propósito: un pedido confirmado se
 * sigue editando —lo dice el dominio— y el inventario tiene que seguir la
 * corrección igual que la hace la cartera.
 */
create or replace function sync_run_inventory(p_run_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from inventory_movements
   where run_id = p_run_id and reason = 'venta';

  -- Solo un pedido confirmado consume inventario: mientras es borrador lo que
  -- hay es una intención, no una salida. El borrado va antes de esta guarda a
  -- propósito — si un pedido se devuelve a borrador, el stock se libera.
  if (select status from delivery_runs where id = p_run_id) = 'borrador' then
    return 0;
  end if;

  with consumed as (
    select
      c.item_id,
      sum(oi.quantity * c.qty_per_unit) as total
    from orders oi_o
    join order_items oi on oi.order_id = oi_o.id
    join inventory_consumption c on c.product_id = oi.product_id
    where oi_o.run_id = p_run_id
    group by c.item_id
    having sum(oi.quantity * c.qty_per_unit) > 0
  )
  insert into inventory_movements (item_id, delta, reason, run_id, note)
  select item_id, -total, 'venta', p_run_id, 'Consumo del pedido semanal'
    from consumed;

  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Seguridad
-- ─────────────────────────────────────────────────────────────

alter table inventory_items       enable row level security;
alter table inventory_consumption enable row level security;
alter table inventory_movements   enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'inventory_items','inventory_consumption','inventory_movements'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      t || '_read', t);
  end loop;
end $$;

-- Quien produce y quien administra mueven inventario. Reparto no: reporta,
-- igual que con el efectivo.
do $$
declare t text;
begin
  foreach t in array array[
    'inventory_items','inventory_consumption','inventory_movements'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated
         using (auth_role() in (''admin'',''produccion'',''contabilidad''))
         with check (auth_role() in (''admin'',''produccion'',''contabilidad''))',
      t || '_write', t);
  end loop;
end $$;

grant select on v_inventory_stock to authenticated;
grant execute on function sync_run_inventory(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Datos iniciales
-- ─────────────────────────────────────────────────────────────

insert into inventory_items (name, unit, kind, sort_order)
values
  ('Miel',      'unidad', 'producto', 1),
  ('Mermelada', 'unidad', 'producto', 2),
  ('Cartones',  'cartón', 'insumo',   3);

-- Miel y mermelada descuentan una unidad de inventario por unidad vendida.
insert into inventory_consumption (product_id, item_id, qty_per_unit)
select p.id, i.id, 1
  from products p
  join inventory_items i on i.name = p.name
 where p.name in ('Miel','Mermelada');

-- Cartones: una cubeta se lleva dos. Media cubeta, uno; el huevo pequeño va
-- en la misma presentación de 30. Estas dos últimas son una extensión
-- razonable de la regla, no un dato confirmado — se ajustan desde la
-- pantalla de inventario sin tocar código.
insert into inventory_consumption (product_id, item_id, qty_per_unit)
select p.id, i.id,
       case p.name
         when 'Cubeta'        then 2
         when 'Media cubeta'  then 1
         when 'Huevo pequeño' then 2
       end
  from products p
 cross join inventory_items i
 where i.name = 'Cartones'
   and p.name in ('Cubeta','Media cubeta','Huevo pequeño');
