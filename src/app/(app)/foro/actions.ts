'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getProfile } from '@/lib/auth'
import {
  createPost,
  deletePost,
  findMentions,
  listMentionable,
  replyToPost,
  toggleResolved,
} from '@/modules/forum'
import type { PostKind } from '@/modules/forum/types'
import { appUrl, listTeamContacts, sendEach } from '@/modules/email'

export type ForumState = { error: string | null; message: string | null }

/** Reparto no participa del foro: es conversación de operación y cartera. */
async function requireTeam() {
  const profile = await getProfile()
  if (!profile || profile.role === 'reparto') return null
  return profile
}

/** "Ana", "Ana y Luis", "Ana, Luis y Sofía". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

/**
 * Avisa a quien fue nombrado con `@`, y cuenta qué pasó.
 *
 * A quién le toca se resuelve antes de responder —es una consulta— para poder
 * decírselo a quien publicó. El envío en cambio va dentro de `after`, o sea
 * cuando la respuesta ya viajó: publicar no puede quedar esperando a un
 * servidor de correo, ni fallar por él.
 *
 * Que el resultado se vea no es un adorno. Antes, una mención que no le caía a
 * nadie —porque el nombre estaba mal escrito, porque esa persona no tiene
 * buzón, o porque uno se nombró a sí mismo— se perdía sin dejar rastro, y
 * quien escribió se quedaba esperando una respuesta que nunca iba a llegar.
 */
async function notifyMentions(input: {
  body: string
  authorId: string
  authorName: string
  context: string
}): Promise<string> {
  try {
    const [team, contacts] = await Promise.all([
      listMentionable(),
      listTeamContacts(),
    ])

    const mentioned = findMentions(input.body, team, input.authorId)
    const namedSelf = findMentions(input.body, team).some(
      (p) => p.id === input.authorId,
    )

    const byId = new Map(contacts.map((c) => [c.id, c]))
    const reachable = mentioned.filter((p) => byId.has(p.id))
    const noMailbox = mentioned.filter((p) => !byId.has(p.id))

    if (reachable.length > 0) {
      after(async () => {
        try {
          const results = await sendEach(
            reachable.map((person) => ({
              to: [byId.get(person.id)!],
              subject: `${input.authorName} te mencionó en el foro`,
              heading: `${input.authorName} te mencionó`,
              paragraphs: [input.context, input.body],
              action: { label: 'Abrir el foro', url: appUrl('/foro') },
            })),
          )
          for (const result of results) {
            if (result.status !== 'enviado') {
              console.error('[foro] aviso no enviado:', result.reason)
            }
          }
        } catch (e) {
          console.error('[foro] no pude mandar los avisos', e)
        }
      })
    }

    const parts: string[] = []
    if (reachable.length > 0) {
      const names = joinNames(reachable.map((p) => p.fullName))
      parts.push(
        reachable.length === 1 ? `Le avisé a ${names}.` : `Les avisé a ${names}.`,
      )
    }
    if (noMailbox.length > 0) {
      parts.push(
        `${joinNames(noMailbox.map((p) => p.fullName))} no tiene correo, así que no le llegó aviso.`,
      )
    }
    if (parts.length === 0 && namedSelf) {
      parts.push('No te mando correo a ti mismo.')
    }
    return parts.join(' ')
  } catch (e) {
    console.error('[foro] no pude resolver las menciones', e)
    return ''
  }
}

export async function createPostAction(
  _prev: ForumState,
  formData: FormData,
): Promise<ForumState> {
  const profile = await requireTeam()
  if (!profile) return { error: 'No tienes acceso al foro.', message: null }

  const body = String(formData.get('body') ?? '')

  try {
    await createPost({
      authorId: profile.id,
      kind: (formData.get('kind') as PostKind) ?? 'nota',
      body,
      runId: String(formData.get('runId') ?? '') || null,
      customerId: String(formData.get('customerId') ?? '') || null,
    })

    const notice = await notifyMentions({
      body,
      authorId: profile.id,
      authorName: profile.fullName,
      context: 'Publicó esto en el foro:',
    })

    revalidatePath('/foro')
    return { error: null, message: `Publicado. ${notice}`.trim() }
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }
}

export async function replyAction(
  _prev: ForumState,
  formData: FormData,
): Promise<ForumState> {
  const profile = await requireTeam()
  if (!profile) return { error: 'No tienes acceso al foro.', message: null }

  const body = String(formData.get('body') ?? '')

  try {
    await replyToPost(String(formData.get('postId') ?? ''), profile.id, body)

    const notice = await notifyMentions({
      body,
      authorId: profile.id,
      authorName: profile.fullName,
      context: 'Respondió en el foro:',
    })

    revalidatePath('/foro')
    return { error: null, message: notice || null }
  } catch (e) {
    return { error: (e as Error).message, message: null }
  }
}

export async function toggleResolvedAction(formData: FormData): Promise<void> {
  const profile = await requireTeam()
  if (!profile) return

  await toggleResolved(
    String(formData.get('postId') ?? ''),
    profile.id,
    formData.get('resolved') === 'true',
  )
  revalidatePath('/foro')
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const profile = await requireTeam()
  if (!profile) return

  await deletePost(String(formData.get('postId') ?? ''))
  revalidatePath('/foro')
}
