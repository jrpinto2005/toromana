/**
 * Módulo de foro — API pública.
 *
 * ⚠️ Solo desde componentes de servidor. Los componentes 'use client'
 * importan sus tipos de `@/modules/forum/types`.
 */

export type { Post, PostKind, Reply } from './types'
export { KIND_LABEL } from './types'
export {
  findMentions,
  extractHandles,
  type MentionablePerson,
} from './mentions'
export {
  listPosts,
  countOpenPosts,
  listMentionable,
  type PostFilter,
} from './queries'
export {
  createPost,
  replyToPost,
  toggleResolved,
  deletePost,
  type NewPost,
} from './mutations'
