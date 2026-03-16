export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pbkdf2Sync, randomBytes } from 'crypto'
import { getDb } from '@/lib/db'
import { getSessionUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'

function requireAdmin() {
  const token = cookies().get('session')?.value
  if (!token) return null
  // getSessionUserFromToken is async but we call it as sync-compatible via await at call site
  return token
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = pbkdf2Sync(password, salt, 100000, 64, 'sha256').toString('hex')
  return `${salt}:${hash}`
}

async function getAdmin() {
  const token = cookies().get('session')?.value
  if (!token) return null
  const user = await getSessionUserFromToken(token)
  if (!user || user.username !== 'admin') return null
  return user
}

// GET /api/admin/users — list all users
export async function GET() {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const result = await getDb().execute({
    sql: 'SELECT id, username, created_at FROM users ORDER BY id ASC',
    args: [],
  })

  return NextResponse.json({ users: result.rows })
}

// POST /api/admin/users — create user
export async function POST(request: Request) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { username, password } = await request.json()
  if (!username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Usuario y contraseña son requeridos' }, { status: 400 })
  }

  const existing = await getDb().execute({
    sql: 'SELECT id FROM users WHERE username = ? LIMIT 1',
    args: [username.trim()],
  })
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 })
  }

  const password_hash = hashPassword(password)
  const res = await getDb().execute({
    sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id, username',
    args: [username.trim(), password_hash],
  })

  return NextResponse.json({ user: res.rows[0] }, { status: 201 })
}
