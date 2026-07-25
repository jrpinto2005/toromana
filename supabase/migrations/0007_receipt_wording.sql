-- ═══════════════════════════════════════════════════════════════════
-- Redacción de los productos en el recibo
--
-- El nombre corto que se usa en la app ("Cubeta") no es el que va impreso en
-- la orden de compra que firma el cliente ("HUEVO CAMPESINO POR CUBETA DE 30
-- huevos"). Son dos textos con propósitos distintos: uno cabe en una columna,
-- el otro es lo que quedó pactado por escrito. Separarlos permite que el
-- documento salga idéntico al que el negocio viene entregando.
-- ═══════════════════════════════════════════════════════════════════

alter table products add column receipt_description text;

update products set receipt_description =
  'HUEVO CAMPESINO POR CUBETA DE 30 huevos' where name = 'Cubeta';
update products set receipt_description =
  'HUEVO CAMPESINO POR MEDIA CUBETA DE 15 huevos' where name = 'Media cubeta';
update products set receipt_description =
  'HUEVO CAMPESINO PEQUEÑO POR CUBETA DE 30 huevos' where name = 'Huevo pequeño';
update products set receipt_description =
  'MORA DE CASTILLA PRIME SELECCIONADA MARCA TOROMANA CAJA X 500GR' where name = 'Moras';
update products set receipt_description =
  'MERMELADA DE MORA ARTESANAL MARCA TOROMANA' where name = 'Mermelada';
update products set receipt_description =
  'MIEL DE ABEJAS PURA MARCA TOROMANA' where name = 'Miel';
update products set receipt_description =
  'MANDARINA SELECCIONADA' where name = 'Mandarinas';
update products set receipt_description =
  'LIMÓN SELECCIONADO' where name = 'Limones';
