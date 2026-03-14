import { cookies } from 'next/headers'
import { verifySessionToken } from './session'

export type SessionUser = { id: number; username: string }

// Para Server Components y Server Actions
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = cookies().get('session')?.value
  if (!token) return null
  const session = await verifySessionToken(token)
  if (!session) return null
  return { id: session.id, username: session.username }
}

// Para API Routes (reciben el cookie como string)
export async function getSessionUserFromToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null
  const session = await verifySessionToken(token)
  if (!session) return null
  return { id: session.id, username: session.username }
}
