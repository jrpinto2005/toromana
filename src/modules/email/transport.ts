import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'
import { renderEmail, renderText } from './templates'
import type { EmailMessage, EmailResult } from './types'

/**
 * Envío de correo por SMTP.
 *
 * Se usa la cuenta de Gmail del negocio porque no hay dominio propio, y sin
 * dominio verificado los servicios de correo transaccional solo entregan a la
 * cuenta que los contrató — es decir, a nadie del equipo. Con SMTP el
 * remitente es la misma cuenta que ya usan, y les llega a los cuatro.
 *
 * El costo es un apretón de manos TLS por invocación: en funciones sin estado
 * no hay conexión que reutilizar entre llamadas. Con cuatro usuarios y un
 * puñado de avisos por semana, es irrelevante.
 *
 * Si falta configuración, no se envía y no se rompe nada: el aviso es
 * secundario respecto de la operación que lo dispara. Confirmar el pedido
 * tiene que funcionar aunque el correo esté caído.
 */

let cached: Transporter | null = null

function transport(): Transporter | null {
  const user = process.env.SMTP_USER?.trim()

  // Google muestra la contraseña de aplicación partida en cuatro grupos
  // ("abcd efgh ijkl mnop") y casi todo el mundo la copia tal cual. Los
  // espacios no son parte de la clave, pero SMTP los manda literales y el
  // servidor responde "Username and Password not accepted" — un error que
  // apunta al usuario y no a lo que realmente pasa.
  const pass = process.env.SMTP_PASSWORD?.replace(/\s/g, '')

  if (!user || !pass) return null

  if (!cached) {
    const port = Number(process.env.SMTP_PORT ?? 465)
    cached = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port,
      // 465 va cifrado desde el saludo; 587 negocia STARTTLS después.
      secure: port === 465,
      auth: { user, pass },
    })
  }
  return cached
}

/**
 * Remitente.
 *
 * Gmail exige que coincida con la cuenta autenticada (o con un alias suyo);
 * si no, reescribe el encabezado y el correo sale con una dirección distinta
 * a la que se declaró. Por eso, si no hay EMAIL_FROM, se usa el propio
 * usuario SMTP en vez de inventar uno.
 */
function sender(): string {
  return process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? ''
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const to = message.to.map((r) => r.email.trim()).filter(Boolean)
  if (to.length === 0) {
    return { status: 'omitido', reason: 'El destinatario no tiene correo.' }
  }

  const mailer = transport()
  if (!mailer) {
    return {
      status: 'omitido',
      reason: 'Faltan SMTP_USER y SMTP_PASSWORD: el correo quedó sin enviar.',
    }
  }

  try {
    const info = await mailer.sendMail({
      from: sender(),
      to,
      subject: message.subject,
      html: renderEmail(message),
      text: renderText(message),
    })

    return { status: 'enviado', id: info.messageId ?? null }
  } catch (e) {
    return { status: 'error', reason: (e as Error).message }
  }
}

/**
 * Envía a varios destinatarios por separado.
 *
 * Uno por correo y no todos en el mismo `to`: son avisos internos con nombre
 * propio, y ver la lista de los demás en el encabezado invita a responder a
 * todos, que es exactamente el ruido que esto viene a quitar.
 */
export async function sendEach(
  messages: EmailMessage[],
): Promise<EmailResult[]> {
  return Promise.all(messages.map(sendEmail))
}

/** Base para los enlaces de los correos. */
export function appUrl(path = ''): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000')
  return `${base.replace(/\/$/, '')}${path}`
}

/**
 * Comprueba que el servidor SMTP acepta las credenciales, sin mandar nada.
 *
 * Sirve para saber si los avisos van a salir antes de depender de ellos.
 */
export async function verifyEmailSetup(): Promise<EmailResult> {
  const mailer = transport()
  if (!mailer) {
    return {
      status: 'omitido',
      reason: 'Faltan SMTP_USER y SMTP_PASSWORD.',
    }
  }

  try {
    await mailer.verify()
    return { status: 'enviado', id: null }
  } catch (e) {
    return { status: 'error', reason: (e as Error).message }
  }
}
