-- ═══════════════════════════════════════════════════════════════════
-- Realtime
--
-- Sin esto la edición colaborativa del pedido no emite nada: los tres
-- vendedores editarían el mismo pedido a ciegas, que es exactamente el
-- problema del WhatsApp que vinimos a resolver.
-- ═══════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
alter publication supabase_realtime add table payments;

grant select on orders, order_items, payments to authenticated;
