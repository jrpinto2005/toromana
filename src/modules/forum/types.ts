export type PostKind = 'idea' | 'pendiente' | 'queja' | 'nota'

export type Reply = {
  id: string
  authorName: string
  body: string
  createdAt: string
}

export type Post = {
  id: string
  authorId: string
  authorName: string
  kind: PostKind
  body: string
  runId: string | null
  runDate: string | null
  customerId: string | null
  customerName: string | null
  resolvedAt: string | null
  createdAt: string
  replies: Reply[]
}

export const KIND_LABEL: Record<PostKind, string> = {
  idea: 'Idea',
  pendiente: 'Pendiente',
  queja: 'Queja de cliente',
  nota: 'Nota',
}
