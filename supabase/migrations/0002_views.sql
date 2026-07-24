-- ═══════════════════════════════════════════════════════════════════
-- Vistas derivadas
--
-- Los saldos NO se almacenan. Un saldo guardado se desincroniza — es
-- exactamente lo que le pasa hoy a la macro de Excel del negocio.
-- Uno derivado no puede mentir.
-- ═══════════════════════════════════════════════════════════════════

-- Todo lo que se le ha cobrado a un cliente, en orden cronológico:
-- el saldo que traía del Excel, más cada pedido confirmado.
create or replace view v_charges as
  select id           as customer_id,
         opening_balance_date as charge_date,
         opening_balance_cop  as amount
    from customers
   where opening_balance_cop > 0
     and opening_balance_date is not null
  union all
  select o.customer_id,
         r.delivery_date,
         o.total_cop
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
    left join (
      select customer_id, sum(amount) as total
        from v_charges
       group by customer_id
    ) ch on ch.customer_id = cu.id
    left join (
      select customer_id, sum(amount_cop) as total
        from payments
       where status = 'confirmado'
       group by customer_id
    ) pa on pa.customer_id = cu.id;

-- FIFO: los pagos cubren la deuda más antigua primero. De aquí sale el dato
-- que de verdad importa — hace cuánto está sin pagar lo más viejo — que es lo
-- que ordena el panel de cobros por urgencia.
create or replace view v_customer_debt as
  select b.customer_id,
         b.charged_cop,
         b.paid_cop,
         b.balance_cop,
         d.oldest_unpaid_date,
         case
           when b.balance_cop <= 0 or d.oldest_unpaid_date is null then 0
           else (current_date - d.oldest_unpaid_date)
         end as days_overdue
    from v_customer_balance b
    left join lateral (
      select min(r.charge_date) as oldest_unpaid_date
        from (
          select ch.charge_date,
                 sum(ch.amount) over (
                   order by ch.charge_date
                   rows between unbounded preceding and current row
                 ) as cum
            from v_charges ch
           where ch.customer_id = b.customer_id
        ) r
       where r.cum > b.paid_cop
    ) d on true;

-- Cantidad actual de gallinas por lote, derivada de los eventos.
-- Nunca se teclea suelta: se calcula desde el inicial y los movimientos.
create or replace view v_hen_lot_status as
  select l.id,
         l.code,
         l.entry_date,
         l.initial_count,
         l.breed,
         l.active,
         l.initial_count
           - coalesce(sum(e.quantity) filter (
               where e.type in ('mortalidad','venta','descarte')), 0)
           + coalesce(sum(e.quantity) filter (
               where e.type = 'ingreso'), 0)
           as current_count
    from hen_lots l
    left join hen_lot_events e on e.lot_id = l.id
   group by l.id;
