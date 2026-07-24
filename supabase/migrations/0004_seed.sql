-- ═══════════════════════════════════════════════════════════════════
-- Semillas
--
-- Solo catálogos. Los clientes entran por el importador del Excel y los
-- usuarios se crean a mano en Supabase Auth (el registro está cerrado).
-- Aquí no va NINGÚN dato personal: el repositorio es público.
-- ═══════════════════════════════════════════════════════════════════

-- Precios de lista, tomados de la fila de precios de las hojas semanales.
-- Son editables desde Ajustes; esto es solo el punto de partida.
insert into products (name, unit, list_price_cop, sort_order) values
  ('Moras',      'libra',        10000, 1),
  ('Mermelada',  'unidad',       20000, 2),
  ('Huevos',     'cubeta de 30', 20000, 3),
  ('Miel',       'unidad',       20000, 4),
  ('Mandarinas', 'libra',        10000, 5),
  ('Limones',    'unidad',        4000, 6);

-- Dos secuencias independientes de recibos, con numeraciones distintas.
-- Los valores reales se ajustan desde Ajustes contra el histórico en papel:
-- lo único que importa es que nunca se repita un número.
insert into document_sequences (name, next_number) values
  ('general',         1),
  ('institucional_b', 1);
