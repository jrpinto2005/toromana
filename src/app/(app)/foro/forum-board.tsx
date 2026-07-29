'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { formatShortDate } from '@/lib/dates'
import { KIND_LABEL, type Post, type PostKind } from '@/modules/forum/types'
import {
  createPostAction,
  deletePostAction,
  replyAction,
  toggleResolvedAction,
  type ForumState,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MentionInput } from './mention-input'
import { MentionText } from './mention-text'
import { findMentions, type MentionablePerson } from '@/modules/forum/mentions'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'

const initial: ForumState = { error: null, message: null }

const KIND_STYLE: Record<PostKind, string> = {
  idea: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  pendiente: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  queja: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  nota: 'bg-muted text-muted-foreground',
}

type Ref = { id: string; name: string }
type RunRef = { id: string; date: string }

export function ForumBoard({
  posts,
  currentUserId,
  customers,
  runs,
  team,
}: {
  posts: Post[]
  currentUserId: string
  customers: Ref[]
  runs: RunRef[]
  team: MentionablePerson[]
}) {
  const [filter, setFilter] = useState<'todos' | 'abiertos' | PostKind>('todos')

  const visible = useMemo(() => {
    if (filter === 'todos') return posts
    if (filter === 'abiertos') return posts.filter((p) => !p.resolvedAt)
    return posts.filter((p) => p.kind === filter)
  }, [posts, filter])

  const openCount = posts.filter(
    (p) => !p.resolvedAt && (p.kind === 'pendiente' || p.kind === 'queja'),
  ).length

  return (
    <div className="space-y-6">
      <NewPostForm
        customers={customers}
        runs={runs}
        team={team}
        currentUserId={currentUserId}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['todos', 'Todo'],
            ['abiertos', `Sin resolver (${openCount})`],
            ['pendiente', 'Pendientes'],
            ['queja', 'Quejas'],
            ['idea', 'Ideas'],
            ['nota', 'Notas'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            size="sm"
            variant={filter === value ? 'default' : 'outline'}
            onClick={() => setFilter(value as typeof filter)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {visible.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            team={team}
          />
        ))}

        {visible.length === 0 && (
          <EmptyState
            title={
              filter === 'todos'
                ? 'El foro está vacío'
                : 'Nada con ese filtro'
            }
          >
            {filter === 'todos'
              ? 'Aquí van las ideas, los pendientes y las quejas que hoy se pierden en los chats. Cada nota se puede amarrar a una semana o a un cliente, y sigue estando ahí cuando el mismo problema vuelva a aparecer.'
              : 'Prueba con otro filtro, o mira todo.'}
          </EmptyState>
        )}
      </div>
    </div>
  )
}

function NewPostForm({
  customers,
  runs,
  team,
  currentUserId,
}: {
  customers: Ref[]
  runs: RunRef[]
  team: MentionablePerson[]
  currentUserId: string
}) {
  const [kind, setKind] = useState<PostKind>('nota')
  // El campo es controlado, así que React no lo limpia solo al enviar. Se
  // remonta con la `key`, que es la forma documentada de reiniciar estado.
  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState(0)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customer, setCustomer] = useState<Ref | null>(null)
  const [pending, startTransition] = useTransition()

  function formAction(formData: FormData) {
    startTransition(async () => {
      const result = await createPostAction(initial, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.message) toast.success(result.message)
      setDraft('')
      setSent((n) => n + 1)
      setCustomer(null)
      setCustomerQuery('')
    })
  }

  const matches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (q.length < 2 || customer) return []
    return customers.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 5)
  }, [customers, customerQuery, customer])

  return (
    <form action={formAction} className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap gap-1">
        {(Object.keys(KIND_LABEL) as PostKind[]).map((k) => (
          <Button
            key={k}
            type="button"
            size="sm"
            variant={kind === k ? 'default' : 'outline'}
            onClick={() => setKind(k)}
          >
            {KIND_LABEL[k]}
          </Button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />

      <MentionInput
        key={sent}
        name="body"
        people={team}
        onValueChange={setDraft}
        multiline
        required
        rows={3}
        placeholder="¿Qué pasó, qué se te ocurrió, qué quedó pendiente? Escribe @ para nombrar a alguien"
      />

      {/* Quién va a recibir el correo, mientras se escribe. Enterarse después
          de publicar —o no enterarse— es lo que hacía que una mención mal
          escrita se perdiera sin que nadie lo notara. */}
      {(() => {
        const avisados = findMentions(draft, team, currentUserId)
        if (avisados.length === 0) return null
        return (
          <p className="text-xs text-muted-foreground">
            Le va a llegar aviso a{' '}
            <span className="font-medium text-foreground">
              {avisados.map((p) => p.fullName).join(', ')}
            </span>
          </p>
        )
      })()}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <input type="hidden" name="customerId" value={customer?.id ?? ''} />
          <Input
            value={customer?.name ?? customerQuery}
            onChange={(e) => {
              setCustomer(null)
              setCustomerQuery(e.target.value)
            }}
            placeholder="Sobre un cliente (opcional)"
            className="w-64"
          />
          {matches.length > 0 && (
            <div className="absolute z-20 mt-1 w-64 overflow-hidden rounded-md border bg-background shadow-md">
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCustomer(c)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <select
          name="runId"
          defaultValue=""
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">Sin semana</option>
          {runs.slice(0, 12).map((r) => (
            <option key={r.id} value={r.id}>
              Semana del {formatShortDate(r.date)}
            </option>
          ))}
        </select>

        <Button type="submit" disabled={pending} className="ml-auto">
          {pending ? 'Publicando…' : 'Publicar'}
        </Button>
      </div>
    </form>
  )
}

function PostCard({
  post,
  currentUserId,
  team,
}: {
  post: Post
  currentUserId: string
  team: MentionablePerson[]
}) {
  const [showReply, setShowReply] = useState(false)
  const [replySent, setReplySent] = useState(0)
  const [replying, startTransition] = useTransition()

  function replyFormAction(formData: FormData) {
    startTransition(async () => {
      const result = await replyAction(initial, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.message) toast.success(result.message)
      setReplySent((n) => n + 1)
      setShowReply(false)
    })
  }

  const resolved = Boolean(post.resolvedAt)

  return (
    <article
      className={`rounded-lg border bg-background p-4 ${resolved ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-medium ${KIND_STYLE[post.kind]}`}
        >
          {KIND_LABEL[post.kind]}
        </span>
        <span className="text-sm font-medium">{post.authorName}</span>
        <span className="text-xs text-muted-foreground">
          {formatShortDate(post.createdAt.slice(0, 10))}
        </span>

        {post.customerName && (
          <Badge variant="outline">{post.customerName}</Badge>
        )}
        {post.runDate && (
          <Badge variant="outline">Semana {formatShortDate(post.runDate)}</Badge>
        )}
        {resolved && <Badge variant="secondary">Resuelto</Badge>}

        <div className="ml-auto flex gap-1">
          <form action={toggleResolvedAction}>
            <input type="hidden" name="postId" value={post.id} />
            <input type="hidden" name="resolved" value={String(!resolved)} />
            <Button type="submit" variant="ghost" size="sm">
              {resolved ? 'Reabrir' : 'Resolver'}
            </Button>
          </form>
          {post.authorId === currentUserId && (
            <form action={deletePostAction}>
              <input type="hidden" name="postId" value={post.id} />
              <Button type="submit" variant="ghost" size="sm" title="Borrar">
                ✕
              </Button>
            </form>
          )}
        </div>
      </div>

      <MentionText
        body={post.body}
        people={team}
        className="mt-2 whitespace-pre-line text-sm"
      />

      {post.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 pl-3">
          {post.replies.map((reply) => (
            <div key={reply.id} className="text-sm">
              <span className="font-medium">{reply.authorName}</span>{' '}
              <span className="text-xs text-muted-foreground">
                {formatShortDate(reply.createdAt.slice(0, 10))}
              </span>
              <MentionText
                body={reply.body}
                people={team}
                className="whitespace-pre-line"
              />
            </div>
          ))}
        </div>
      )}

      {showReply ? (
        <form action={replyFormAction} className="mt-3 flex gap-2">
          <input type="hidden" name="postId" value={post.id} />
          <MentionInput
            key={replySent}
            name="body"
            people={team}
            placeholder="Responder… escribe @ para nombrar a alguien"
            required
            autoFocus
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={replying}>
            Enviar
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => setShowReply(true)}
        >
          Responder
        </Button>
      )}
    </article>
  )
}
