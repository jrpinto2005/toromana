/**
 * Módulo de correo — API pública.
 *
 * Vive aparte de `notifications` a propósito. Ese módulo es puro y lo importan
 * componentes cliente —la tabla de cartera, entre otros—; si el envío colgara
 * de su `index.ts`, el `server-only` del transporte viajaría al navegador y el
 * build reventaría. Aquí queda todo lo que produce un efecto externo.
 *
 * Este módulo NO decide a quién avisar ni por qué. Recibe un mensaje armado y
 * lo despacha: quien conoce las reglas es el módulo del dominio que lo llama.
 */

export type {
  EmailAction,
  EmailMessage,
  EmailRecipient,
  EmailResult,
} from './types'
export { isSent } from './types'

export { sendEmail, sendEach, appUrl, verifyEmailSetup } from './transport'
export {
  listTeamContacts,
  getTeamContact,
  type TeamMemberContact,
} from './recipients'
