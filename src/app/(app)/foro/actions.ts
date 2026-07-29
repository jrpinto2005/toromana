'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { getProfile } from '@/lib/auth'
import {
  createPost,
  deletePost,
  findMentions,
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

/**
 * Avisa por correo a quien fue nombrado con `@`.
 *
 * Va dentro de `after`: el correo sale cuando la respuesta ya viajó al
 * navegador. Publicar en el foro no puede quedar esperando a un servidor de
 * correo, y menos fallar por él — el mensaje ya está guardado, el aviso es
 * una cortesía.
 */
function notifyMentions(input: {
  body: string
  authorId: string
  authorName: string
  context: string
}): void {
  after(async () => {
    try {
      const contacts = await listTeamContacts()
      const mentioned = findMentions(
        input.body,
        contacts.map((c) => ({ id: c.id, fullName: c.name ?? '' })),
        input.authorId,
      )
      if (mentioned.length === 0) return

      const byId = new Map(contacts.map((c) => [c.id, c]))

      const results = await sendEach(
        mentioned.map((person) => {
          const contact = byId.get(person.id)!
          return {
            to: [contact],
            subject: `${input.authorName} te mencionó en el foro`,
            heading: `${input.authorName} te mencionó`,
            paragraphs: [input.context, input.body],
            action: { label: 'Abrir el foro', url: appUrl('/foro') },
          }
        }),
      )

      for (const result of results) {
        if (result.status !== 'enviado') {
          console.error('[foro] aviso de mención no enviado:', result.reason)
        }
      }
    } catch (e) {
      console.error('[foro] no pude avisar de las menciones', e)
    }
  })
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

    notifyMentions({
      body,
      authorId: profile.id,
      authorName: profile.fullName,
      context: 'Publicó esto en el foro:',
    })

    revalidatePath('/foro')
    return { error: null, message: 'Publicado.' }
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

    notifyMentions({
      body,
      authorId: profile.id,
      authorName: profile.fullName,
      context: 'Respondió en el foro:',
    })

    revalidatePath('/foro')
    return { error: null, message: null }
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
