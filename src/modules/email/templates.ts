import type { EmailMessage } from './types'

/**
 * Plantilla HTML de los correos.
 *
 * Tablas y estilos en línea, sin hojas de estilo ni flexbox: los clientes de
 * correo llevan veinte años ignorando el CSS moderno, y Outlook sigue
 * renderizando con el motor de Word. Esto se ve igual en Gmail, en Outlook y
 * en el iPhone, que es donde el equipo lo va a leer.
 */

const VERDE = '#46685a'
const BORDE = '#e2e5e3'
const TEXTO = '#1f2421'
const TENUE = '#6b7570'
const ALERTA = '#b4530a'

/** El correo es HTML; cualquier dato que venga de la base se escapa. */
function escape(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderEmail(message: EmailMessage): string {
  const paragraphs = message.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${TEXTO}">${escape(p)}</p>`,
    )
    .join('')

  const rows = message.rows?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
              style="margin:8px 0 18px;border-collapse:collapse">
         ${message.rows
           .map(
             (row) => `
           <tr>
             <td style="padding:8px 10px;border-bottom:1px solid ${BORDE};font-size:14px;color:${TEXTO}">
               ${escape(row.label)}
             </td>
             <td style="padding:8px 10px;border-bottom:1px solid ${BORDE};font-size:14px;
                        text-align:right;font-weight:600;color:${row.alert ? ALERTA : TEXTO}">
               ${escape(row.value)}
             </td>
           </tr>`,
           )
           .join('')}
       </table>`
    : ''

  const action = message.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px">
         <tr><td style="border-radius:6px;background:${VERDE}">
           <a href="${escape(message.action.url)}"
              style="display:inline-block;padding:11px 20px;font-size:14px;font-weight:600;
                     color:#ffffff;text-decoration:none">${escape(message.action.label)}</a>
         </td></tr>
       </table>`
    : ''

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(message.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f5f4">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
         style="background:#f4f5f4;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
             style="max-width:560px;background:#ffffff;border:1px solid ${BORDE};border-radius:10px">
        <tr><td style="padding:20px 24px;border-bottom:1px solid ${BORDE}">
          <span style="font-size:15px;font-weight:700;letter-spacing:.02em;color:${VERDE}">
            Toromana
          </span>
        </td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 14px;font-size:19px;line-height:1.35;color:${TEXTO}">
            ${escape(message.heading)}
          </h1>
          ${paragraphs}
          ${rows}
          ${action}
        </td></tr>
        <tr><td style="padding:14px 24px;border-top:1px solid ${BORDE}">
          <p style="margin:0;font-size:12px;line-height:1.5;color:${TENUE}">
            Aviso automático de Toromana. Llega solo a las cuentas del equipo.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

/** Versión en texto plano, para clientes que no muestran HTML. */
export function renderText(message: EmailMessage): string {
  const parts = [message.heading, '', ...message.paragraphs]
  if (message.rows?.length) {
    parts.push('')
    for (const row of message.rows) parts.push(`${row.label}: ${row.value}`)
  }
  if (message.action) {
    parts.push('', `${message.action.label}: ${message.action.url}`)
  }
  return parts.join('\n')
}
