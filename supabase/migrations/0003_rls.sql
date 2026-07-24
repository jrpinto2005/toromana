-- ═══════════════════════════════════════════════════════════════════
-- Row Level Security
--
-- Esto NO es opcional. Supabase expone PostgREST con la llave anónima:
-- sin RLS, la base completa de clientes queda legible desde internet
-- para cualquiera que abra las herramientas de desarrollo del navegador.
--
-- Con 4 usuarios que se conocen y se hablan a diario, las políticas
-- protegen del internet, no de ellos entre sí. De ahí que la lectura sea
-- abierta a cualquier autenticado: los vendedores NECESITAN ver los
-- clientes de los otros — es literalmente el problema que vinimos a resolver.
-- ═══════════════════════════════════════════════════════════════════

create or replace function auth_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

alter table profiles            enable row level security;
alter table company_settings    enable row level security;
alter table products            enable row level security;
alter table customers           enable row level security;
alter table standing_order_items enable row level security;
alter table customer_pauses     enable row level security;
alter table delivery_runs       enable row level security;
alter table orders              enable row level security;
alter table order_items         enable row level security;
alter table payments            enable row level security;
alter table document_sequences  enable row level security;
alter table purchase_orders     enable row level security;
alter table hen_lots            enable row level security;
alter table hen_lot_events      enable row level security;
alter table egg_production      enable row level security;

-- ── Lectura: cualquier usuario autenticado lee todo ──────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','company_settings','products','customers','standing_order_items',
    'customer_pauses','delivery_runs','orders','order_items','payments',
    'document_sequences','purchase_orders','hen_lots','hen_lot_events','egg_production'
  ] loop
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      t || '_read', t);
  end loop;
end $$;

-- ── Escritura: catálogos y configuración, solo admin ──────────────
do $$
declare t text;
begin
  foreach t in array array['products','company_settings','document_sequences','profiles'] loop
    execute format(
      'create policy %I on %I for all to authenticated
         using (auth_role() = ''admin'') with check (auth_role() = ''admin'')',
      t || '_write_admin', t);
  end loop;
end $$;

-- ── Escritura: clientes y pedidos, los tres vendedores ────────────
do $$
declare t text;
begin
  foreach t in array array[
    'customers','standing_order_items','customer_pauses',
    'delivery_runs','order_items'
  ] loop
    execute format(
      'create policy %I on %I for all to authenticated
         using (auth_role() in (''admin'',''contabilidad'',''produccion''))
         with check (auth_role() in (''admin'',''contabilidad'',''produccion''))',
      t || '_write_sellers', t);
  end loop;
end $$;

-- Pedidos: los vendedores hacen todo; reparto solo marca entregas.
create policy orders_write_sellers on orders for all to authenticated
  using      (auth_role() in ('admin','contabilidad','produccion'))
  with check (auth_role() in ('admin','contabilidad','produccion'));

create policy orders_delivery_update on orders for update to authenticated
  using      (auth_role() = 'reparto')
  with check (auth_role() = 'reparto');

-- ── Pagos ─────────────────────────────────────────────────────────
-- Cualquier vendedor registra un pago confirmado (todos reciben plata).
create policy payments_write_sellers on payments for all to authenticated
  using      (auth_role() in ('admin','contabilidad','produccion'))
  with check (auth_role() in ('admin','contabilidad','produccion'));

-- Reparto solo puede REPORTAR efectivo, nunca confirmarlo ni editarlo.
-- Contabilidad es quien lo vuelve real. Sin esto, el reparto escribiría
-- directo en la contabilidad, que es justo lo que el negocio no quiere.
create policy payments_report_cash on payments for insert to authenticated
  with check (
    auth_role() = 'reparto'
    and status  = 'por_confirmar'
    and method  = 'efectivo'
  );

-- ── Documentos: quien factura ─────────────────────────────────────
create policy purchase_orders_write on purchase_orders for all to authenticated
  using      (auth_role() in ('admin','contabilidad'))
  with check (auth_role() in ('admin','contabilidad'));

-- ── Producción ────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['hen_lots','hen_lot_events','egg_production'] loop
    execute format(
      'create policy %I on %I for all to authenticated
         using (auth_role() in (''admin'',''produccion''))
         with check (auth_role() in (''admin'',''produccion''))',
      t || '_write_production', t);
  end loop;
end $$;

-- ── Vistas ────────────────────────────────────────────────────────
grant select on v_charges, v_customer_balance, v_customer_debt, v_hen_lot_status
  to authenticated;
