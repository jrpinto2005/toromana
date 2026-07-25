-- ═══════════════════════════════════════════════════════════════════
-- Fecha esperada de salida del lote
--
-- Un lote rinde alrededor de un año y después su postura ya no paga el
-- alimento. Saber de antemano cuándo sale cada uno es lo que permite planear
-- la compra del siguiente con la anticipación que exige el ciclo: una gallina
-- que entra hoy no pone nada durante sus primeras semanas, así que esperar a
-- que el lote viejo caiga es esperar demasiado.
-- ═══════════════════════════════════════════════════════════════════

alter table hen_lots add column expected_exit_date date;

-- Un año desde el ingreso para los que ya existen; se ajusta a mano por lote.
update hen_lots
   set expected_exit_date = entry_date + interval '52 weeks'
 where expected_exit_date is null;
