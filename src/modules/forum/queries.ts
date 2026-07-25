import { createClient } from '@/lib/supabase/server'
import type { Post, PostKind, Reply } from './types'

export type PostFilter = {
  runId?: string
  customerId?: string
  onlyOpen?: boolean
}

export async function listPosts(filter: PostFilter = {}): Promise<Post[]> {
  const supabase = await createClient()

  let query = supabase
    .from('forum_posts')
    .select(
      'id, author_id, kind, body, run_id, customer_id, resolved_at, created_at, ' +
        'profiles(full_name), delivery_runs(delivery_date), customers(name), ' +
        'forum_replies(id, body, created_at, profiles(full_name))',
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (filter.runId) query = query.eq('run_id', filter.runId)
  if (filter.customerId) query = query.eq('customer_id', filter.customerId)
  if (filter.onlyOpen) query = query.is('resolved_at', null)

  const { data, error } = await query
  if (error) throw new Error(`No pude cargar el foro: ${error.message}`)

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string
      author_id: string
      kind: PostKind
      body: string
      run_id: string | null
      customer_id: string | null
      resolved_at: string | null
      created_at: string
      profiles: { full_name: string } | null
      delivery_runs: { delivery_date: string } | null
      customers: { name: string } | null
      forum_replies: {
        id: string
        body: string
        created_at: string
        profiles: { full_name: string } | null
      }[]
    }

    const replies: Reply[] = [...(r.forum_replies ?? [])]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((reply) => ({
        id: reply.id,
        authorName: reply.profiles?.full_name ?? '',
        body: reply.body,
        createdAt: reply.created_at,
      }))

    return {
      id: r.id,
      authorId: r.author_id,
      authorName: r.profiles?.full_name ?? '',
      kind: r.kind,
      body: r.body,
      runId: r.run_id,
      runDate: r.delivery_runs?.delivery_date ?? null,
      customerId: r.customer_id,
      customerName: r.customers?.name ?? null,
      resolvedAt: r.resolved_at,
      createdAt: r.created_at,
      replies,
    }
  })
}

/** Cuántos pendientes y quejas siguen abiertos, para el aviso de la navegación. */
export async function countOpenPosts(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('forum_posts')
    .select('id', { count: 'exact', head: true })
    .is('resolved_at', null)
    .in('kind', ['pendiente', 'queja'])

  return count ?? 0
}
