-- ═══════════════════════════════════════════════════════════════════
-- Presentaciones de huevo
--
-- El Excel codificaba en decimales cosas que no son cantidades:
--   0.5  no es "media unidad de cubeta", es la MEDIA CAJA de 15 huevos
--   0.75 no es "tres cuartos", es la caja de 30 huevos PEQUEÑOS
--
-- Que la aritmética diera el precio correcto por casualidad no las vuelve
-- fracciones. Son productos distintos, y modelarlos así es lo que permite
-- además medir producción por tamaño de huevo.
-- ═══════════════════════════════════════════════════════════════════

update products
   set name = 'Cubeta', unit = '30 huevos'
 where name = 'Huevos';

insert into products (name, unit, list_price_cop, sort_order) values
  ('Media cubeta',  '15 huevos',          10000, 4),
  ('Huevo pequeño', '30 huevos pequeños', 15000, 5);

update products set sort_order = 6 where name = 'Miel';
update products set sort_order = 7 where name = 'Mandarinas';
update products set sort_order = 8 where name = 'Limones';

-- Los pedidos habituales que decían 0.5 pasan a 1 media cubeta.
update standing_order_items s
   set product_id = (select id from products where name = 'Media cubeta'),
       quantity   = 1
 where s.quantity = 0.5
   and s.product_id = (select id from products where name = 'Cubeta');

update standing_order_items s
   set product_id = (select id from products where name = 'Huevo pequeño'),
       quantity   = 1
 where s.quantity = 0.75
   and s.product_id = (select id from products where name = 'Cubeta');

-- Lo mismo en pedidos ya creados, conservando el precio que se cobró.
update order_items i
   set product_id = (select id from products where name = 'Media cubeta'),
       quantity   = 1
 where i.quantity = 0.5
   and i.product_id = (select id from products where name = 'Cubeta');

update order_items i
   set product_id = (select id from products where name = 'Huevo pequeño'),
       quantity   = 1
 where i.quantity = 0.75
   and i.product_id = (select id from products where name = 'Cubeta');

-- ─────────────────────────────────────────────────────────────
-- Tamaño de huevo en producción
--
-- Los lotes nuevos ponen huevo pequeño durante sus primeras semanas. Medirlo
-- aparte es lo que permite ver la curva de postura por tamaño y saber cuándo
-- un lote empieza a producir huevo comercial.
-- ─────────────────────────────────────────────────────────────

create type egg_size as enum ('normal','pequeno');

alter table egg_production
  add column size egg_size not null default 'normal';

alter table egg_production
  drop constraint egg_production_lot_id_week_start_key;

alter table egg_production
  add constraint egg_production_lot_week_size_key
  unique (lot_id, week_start, size);
