/**
 * API pública del módulo `notifications`.
 *
 * Todo aquí es puro: recibe datos, devuelve strings o clasificaciones. No lee la
 * base de datos ni manda nada — quien cobra es `cartera`, quien clasifica es este
 * módulo.
 */

export {
  urgencyFor,
  urgencyByLevel,
  ALL_URGENCIES,
  OVERDUE_URGENCIES,
  type Urgency,
  type UrgencyLevel,
} from "./urgency";

export {
  bankDetailsFor,
  collectionMessage,
  deliveryReminderMessage,
  type CollectionContext,
} from "./templates";

export { whatsAppLink, toWhatsAppNumber, hasWhatsApp } from "./whatsapp";
