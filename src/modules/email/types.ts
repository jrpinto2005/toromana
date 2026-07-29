/** Tipos del módulo de correo. Sin dependencias de servidor. */

export type EmailRecipient = { email: string; name?: string | null }

export type EmailAction = { label: string; url: string }

export type EmailMessage = {
  to: EmailRecipient[]
  subject: string
  /** Título dentro del cuerpo. Suele repetir el asunto, no siempre. */
  heading: string
  /** Un párrafo por elemento. Texto plano: la plantilla lo escapa. */
  paragraphs: string[]
  /** Filas de una tabla opcional, para inventario o cifras. */
  rows?: { label: string; value: string; alert?: boolean }[]
  action?: EmailAction
}

/**
 * Resultado de un envío.
 *
 * Nunca lanza: un correo que falla no puede tumbar la operación que lo
 * disparó. Confirmar el pedido de la semana tiene que funcionar aunque el
 * proveedor de correo esté caído, y quien confirma tiene que enterarse de que
 * el aviso no salió — de ahí que el resultado se devuelva en vez de ignorarse.
 */
export type EmailResult =
  | { status: 'enviado'; id: string | null }
  | { status: 'omitido'; reason: string }
  | { status: 'error'; reason: string }

export function isSent(result: EmailResult): boolean {
  return result.status === 'enviado'
}
