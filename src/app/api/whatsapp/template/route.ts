export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

// GET /api/whatsapp/template
export async function GET(req: NextRequest) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const result = await getDb().execute({
    sql: `SELECT body FROM wa_template WHERE user_id = ? LIMIT 1`,
    args: [user.id],
  })

  const body = result.rows.length > 0
    ? (result.rows[0].body as string)
    : 'Hola {nombre}, te contactamos desde Vector-IA.'

  return NextResponse.json({ body })
}

// PUT /api/whatsapp/template
// Body: { body: string }
export async function PUT(req: NextRequest) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { body } = await req.json()
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return NextResponse.json({ error: 'body requerido' }, { status: 400 })
  }

  const now = Math.floor(Date.now() / 1000)
  await getDb().execute({
    sql: `INSERT INTO wa_template (user_id, body, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
    args: [user.id, body.trim(), now],
  })

  return NextResponse.json({ ok: true })
}
