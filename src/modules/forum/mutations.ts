import { createClient } from '@/lib/supabase/server'
import type { PostKind } from './types'

export type NewPost = {
  authorId: string
  kind: PostKind
  body: string
  runId?: string | null
  customerId?: string | null
}

export async function createPost(input: NewPost): Promise<void> {
  const body = input.body.trim()
  if (!body) throw new Error('Escribe algo antes de publicar.')

  const supabase = await createClient()
  const { error } = await supabase.from('forum_posts').insert({
    author_id: input.authorId,
    kind: input.kind,
    body,
    run_id: input.runId || null,
    customer_id: input.customerId || null,
  })

  if (error) throw new Error(`No pude publicar: ${error.message}`)
}

export async function replyToPost(
  postId: string,
  authorId: string,
  body: string,
): Promise<void> {
  const text = body.trim()
  if (!text) throw new Error('Escribe una respuesta.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('forum_replies')
    .insert({ post_id: postId, author_id: authorId, body: text })

  if (error) throw new Error(`No pude responder: ${error.message}`)
}

/**
 * Marca o desmarca como resuelto.
 *
 * Nada se borra: un pendiente resuelto sigue visible en el historial del
 * cliente o de la semana, que es donde vuelve a servir cuando el mismo
 * problema aparece otra vez.
 */
export async function toggleResolved(
  postId: string,
  resolvedBy: string,
  resolved: boolean,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('forum_posts')
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? resolvedBy : null,
    })
    .eq('id', postId)

  if (error) throw new Error(`No pude actualizar: ${error.message}`)
}

export async function deletePost(postId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('forum_posts').delete().eq('id', postId)
  if (error) throw new Error(`No pude borrar: ${error.message}`)
}
