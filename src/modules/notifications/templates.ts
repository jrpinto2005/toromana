/**
 * Plantillas de cobro por WhatsApp.
 *
 * Funciones puras: reciben datos, devuelven strings. El emisor (hoy `wa.me`,
 * mañana la WhatsApp Cloud API) queda afuera — cambiarlo no debería obligar a
 * reescribir cómo se cobra.
 */

import { formatCop } from "@/lib/money";
import { formatLongDate, type IsoDate } from "@/lib/dates";
import { urgencyFor } from "./urgency";

export type CollectionContext = {
  customerName: string;
  balanceCop: number;
  oldestUnpaidDate: IsoDate | null;
  daysOverdue: number;
  /** Datos de la cuenta, desde `company_settings`. Nunca hardcodeados. */
  bankDetails?: string | null;
  brandName?: string | null;
};

/**
 * A qué cuenta se le pide que pague.
 *
 * Un hotel gira contra factura a la cuenta de la empresa; una clienta del
 * barrio transfiere a la cuenta simple. Mandarle a un institucional los datos
 * equivocados termina en un pago mal aplicado y una llamada de contabilidad.
 */
export function bankDetailsFor(
  isInstitutional: boolean,
  company: { bankDetails: string; bankDetailsInstitutional: string },
): string {
  const chosen = isInstitutional
    ? company.bankDetailsInstitutional
    : company.bankDetails
  return chosen?.trim() ? chosen : company.bankDetails
}

/** Primer nombre, para que el saludo no suene a carta de cobranza jurídica. */
function greetingName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  if (first === "") return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/**
 * El tono sube con la antigüedad. Un cliente de 5 días y uno de 4 meses no
 * merecen el mismo mensaje: al primero se le recuerda, al segundo se le pregunta
 * cómo va a pagar. Mandar el mismo texto a los dos es cómo se pierde un cliente
 * bueno o se deja correr una deuda mala.
 */
export function collectionMessage(ctx: CollectionContext): string {
  const { level } = urgencyFor(ctx.balanceCop, ctx.daysOverdue);
  const name = greetingName(ctx.customerName);
  const greeting = name ? `Hola ${name} como estas?, ` : "Hola como estas?, ";
  const amount = formatCop(ctx.balanceCop);

  const since = ctx.oldestUnpaidDate
    ? ` ${formatLongDate(ctx.oldestUnpaidDate)}`
    : "";

  const lines: string[] = [];

  switch (level) {
    case "al_dia":
      lines.push(
        `${greeting}muchas gracias por estar al día con tus pagos. ¡Un gusto atenderte!`,
      );
      return lines.join("\n\n");

    case "reciente":
      lines.push(
        `${greeting}tengo tu cuenta pendiente desde${since} por ${amount}, te cuadra?`,
      );
      break;

    case "atencion":
      lines.push(
        `${greeting}tengo tu cuenta pendiente desde${since} por ${amount}, te cuadra?`,
      );
      break;

    case "urgente":
      lines.push(
        `${greeting}tengo tu cuenta pendiente desde${since} por ${amount}, te cuadra?`,
      );
      break;

    case "critico":
      lines.push(
        `${greeting}tengo tu cuenta pendiente desde${since} por ${amount}, te cuadra?`,
      );
      break;
  }

  if (ctx.bankDetails?.trim()) {
    lines.push(`Puedes pagar por transferencia a:\n${ctx.bankDetails.trim()}`);
  }


  return lines.join("\n\n");
}

/** Aviso de entrega del día siguiente. Útil para los ocasionales. */
export function deliveryReminderMessage(args: {
  customerName: string;
  deliveryDate: IsoDate;
  items: Array<{ productName: string; quantity: number; unit: string }>;
  totalCop: number;
  brandName?: string | null;
}): string {
  const name = greetingName(args.customerName);
  const greeting = name ? `Hola ${name}, ` : "Hola, ";
  const detail = args.items
    .map((i) => `• ${i.quantity} ${i.unit} de ${i.productName}`)
    .join("\n");

  return [
    `${greeting}confirmamos tu entrega para el ${formatLongDate(args.deliveryDate)}:`,
    detail,
    `Total: ${formatCop(args.totalCop)}`,
    args.brandName?.trim() ? `Gracias, ${args.brandName.trim()}.` : "¡Gracias!",
  ]
    .filter(Boolean)
    .join("\n\n");
}
