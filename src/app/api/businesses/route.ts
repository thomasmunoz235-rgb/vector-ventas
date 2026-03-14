export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/session'
import { getDb } from '@/lib/db'

// POST /api/businesses — crear nuevo local
export async function POST(req: NextRequest) {
  const token = req.cookies.get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { name, phone, category, city, email, website } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const now = Math.floor(Date.now() / 1000)
  const result = await getDb().execute({
    sql: `INSERT INTO businesses (place_id, name, phone, category, city, email, website, contacted, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?) RETURNING id`,
    args: [
      `manual_${now}_${Math.random().toString(36).slice(2, 8)}`,
      name.trim(),
      phone?.trim() || null,
      category?.trim() || null,
      city?.trim() || null,
      email?.trim() || null,
      website?.trim() || null,
      now,
      now,
    ],
  })

  return NextResponse.json({ ok: true, id: result.rows[0].id })
}
