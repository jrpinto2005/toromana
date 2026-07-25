-- ═══════════════════════════════════════════════════════════════════
-- Cuenta bancaria separada para institucionales
--
-- Un hotel no paga como una vecina. El institucional gira a la cuenta de la
-- empresa, contra factura y con retenciones; el cliente natural transfiere a
-- una cuenta más simple. Mandarle a un hotel los datos de la cuenta personal
-- —o al revés— genera pagos mal aplicados y llamadas de contabilidad.
-- ═══════════════════════════════════════════════════════════════════

alter table company_settings
  add column bank_details_institutional text not null default '';

-- Arrancan iguales: si el negocio no distingue, no cambia nada. Se separan
-- desde Ajustes cuando haga falta.
update company_settings
   set bank_details_institutional = bank_details
 where bank_details_institutional = '';
