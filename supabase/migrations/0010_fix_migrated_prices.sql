-- ═══════════════════════════════════════════════════════════════════
-- Corrección: precios que quedaron mal al separar las presentaciones
--
-- La migración 0006 convirtió las líneas de "0.5 cubeta" en "1 media cubeta",
-- pero dejó intacto el `unit_price_cop` de $20.000 que traían. La media cubeta
-- vale $10.000, así que esas líneas quedaron cobrando el doble.
--
-- Peor que el error puntual: el precio sugerido de cada pedido nuevo sale del
-- último precio cobrado a ese cliente, así que el dato equivocado se estaba
-- propagando solo hacia adelante.
-- ═══════════════════════════════════════════════════════════════════

update order_items i
   set unit_price_cop = p.list_price_cop
  from products p
 where p.id = i.product_id
   and p.name in ('Media cubeta', 'Huevo pequeño')
   and i.unit_price_cop = 20000;
