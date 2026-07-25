-- ═══════════════════════════════════════════════════════════════════
-- Reparto solo marca entregas
--
-- La política anterior le daba UPDATE sobre `orders` sin restricción de
-- columnas: quien reparte podía cambiar el total de una orden, moverla de
-- semana o reasignarla de cliente. RLS no restringe columnas —eso son GRANTs
-- por rol, y aquí todos son el mismo rol de base de datos— así que la única
-- forma de acotarlo es quitarle el UPDATE directo y darle una función que solo
-- toque lo suyo.
--
-- No es desconfianza: es que un error de dedo en un celular, caminando entre
-- entregas, no debería poder alterar una cifra de la cartera.
-- ═══════════════════════════════════════════════════════════════════

drop policy if exists orders_delivery_update on orders;

create or replace function mark_order_delivered(
  order_id uuid,
  delivered boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role user_role;
begin
  select role into actor_role from profiles where id = auth.uid();

  if actor_role is null or actor_role not in ('reparto','admin') then
    raise exception 'Solo reparto puede marcar entregas';
  end if;

  update orders
     set status       = (case when delivered then 'entregado' else 'pendiente' end)::order_status,
         delivered_at = case when delivered then now() else null end,
         delivered_by = case when delivered then auth.uid() else null end
   where id = order_id;
end $$;

revoke all on function mark_order_delivered(uuid, boolean) from public;
grant execute on function mark_order_delivered(uuid, boolean) to authenticated;
