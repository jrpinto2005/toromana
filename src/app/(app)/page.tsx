import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import { homeFor } from './nav'

/** La raíz no tiene contenido propio: manda a cada rol a donde trabaja. */
export default async function HomePage() {
  const profile = await getProfile()
  if (!profile) redirect('/login')
  redirect(homeFor(profile.role))
}
