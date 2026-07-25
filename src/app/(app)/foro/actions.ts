'use server'

import { revalidatePath } from 'next/cache'
import { getProfile } from '@/lib/auth'
import {
  createPost,
  deletePost,
  replyToPost,
  toggleResolved,
} from '@/modules/forum'
import type { PostKind } from '@/modules/forum/types'

export type ForumState = { error: string | null; message: string | null }

/** Reparto no participa del foro: es conversación de operación y cartera. */
async function requireTeam() {
  const profile = await getProfile()
  if (!profile || profile.role === 'reparto') return null
  return profile
}

export async function createPostAction(
  _prev: ForumState,
  formData: FormData,
): Promise<ForumState> {
  const profile = await requireTeam()
  if (!profile) return { error: 'No tienes acceso al foro.', message: null }

  try {
    await createPost({
      authorId: profile.id,
      kind: (formData.get('kind') as PostKind) ?? 'nota',
      body: String(formData.get('body') ?? ''),
      runId: String(formData.get('runId') ?? '') || null,
      customerId: String(formData.get('customerId') ?? '') || null,
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

  try {
    await replyToPost(
      String(formData.get('postId') ?? ''),
      profile.id,
      String(formData.get('body') ?? ''),
    )
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
