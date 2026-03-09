import { NextResponse } from 'next/server'
import { pbkdf2Sync, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { createSessionToken } from '@/lib/session'

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const attempt = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(attempt, 'hex'))
}

export async function POST(request: Request) {
  const body = await request.json()
  const { user, pass } = body

  if (!user || !pass) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
  }

  const result = await db.execute({
    sql: 'SELECT username, password_hash FROM users WHERE username = ? LIMIT 1',
    args: [user],
  })

  if (result.rows.length === 0 || !verifyPassword(pass, result.rows[0].password_hash as string)) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
  }

  const token = await createSessionToken(result.rows[0].username as string)

  const response = NextResponse.json({ ok: true })
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 días
  })

  return response
}
