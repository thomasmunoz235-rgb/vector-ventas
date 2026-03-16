export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { pbkdf2Sync, randomBytes } from 'crypto'
import { getDb } from '@/lib/db'
import { getSessionUserFromToken } from '@/lib/auth'
import { cookies } from 'next/headers'

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

// PATCH /api/admin/users/[id] — edit username and/or password
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const { username, password } = await request.json()
  if (!username?.trim() && !password?.trim()) {
    return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })
  }

  if (username?.trim()) {
    const conflict = await getDb().execute({
      sql: 'SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1',
      args: [username.trim(), id],
    })
    if (conflict.rows.length > 0) {
      return NextResponse.json({ error: 'El nombre de usuario ya está en uso' }, { status: 409 })
    }
    await getDb().execute({
      sql: 'UPDATE users SET username = ? WHERE id = ?',
      args: [username.trim(), id],
    })
  }

  if (password?.trim()) {
    const password_hash = hashPassword(password)
    await getDb().execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [password_hash, id],
    })
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/users/[id] — delete user (can't delete yourself)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = Number(params.id)
  if (!id) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  if (id === admin.id) {
    return NextResponse.json({ error: 'No podés eliminar tu propio usuario' }, { status: 400 })
  }

  await getDb().execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] })
  return NextResponse.json({ ok: true })
}
