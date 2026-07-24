/**
 * Emisor: enlaces `wa.me`.
 *
 * Es la implementación más barata que existe y funciona hoy, sin aprobación de
 * Meta ni costo por mensaje: se abre WhatsApp con el texto ya redactado y el
 * vendedor solo revisa y envía. El día que haya volumen para justificar la
 * Cloud API, se reemplaza este archivo y las plantillas no se tocan.
 */

const COLOMBIA_CODE = "57";

/**
 * Los teléfonos vienen del Excel en cualquier forma: `3001234567`,
 * `300 123 4567`, `+57 300 1234567`, `(1) 234-5678`. WhatsApp necesita
 * `<indicativo><número>` sin signos.
 *
 * Devuelve `null` cuando el número no alcanza a ser un móvil colombiano, para
 * que la UI deshabilite el botón en vez de abrir un chat con un número roto.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;

  let digits = phone.replace(/\D/g, "");
  if (digits === "") return null;

  // `0057...` y `57...` ya traen indicativo
  if (digits.startsWith("00" + COLOMBIA_CODE)) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith(COLOMBIA_CODE)) {
    digits = digits.slice(COLOMBIA_CODE.length);
  }

  // Móvil colombiano: 10 dígitos que arrancan en 3. Los fijos no reciben WhatsApp.
  if (digits.length !== 10 || !digits.startsWith("3")) return null;

  return COLOMBIA_CODE + digits;
}

export function hasWhatsApp(phone: string | null | undefined): boolean {
  return toWhatsAppNumber(phone) !== null;
}

/** `null` si el teléfono no sirve — nunca un enlace que falla al abrirse. */
export function whatsAppLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
