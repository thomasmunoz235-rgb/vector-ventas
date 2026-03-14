export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

const BOT_URL = process.env.BOT_URL!
const BOT_SECRET = process.env.BOT_SECRET!

// POST /api/whatsapp/connect
// Le dice al bot que inicie sesión para este vendor
// El bot genera QR y lo guarda en Turso como pending_qr:{userId}
export async function POST(req: NextRequest) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const res = await fetch(`${BOT_URL}/session/${user.id}/connect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Bot no disponible' }, { status: 503 })
  }
}

// DELETE /api/whatsapp/connect
// Desconecta la sesión del vendor
export async function DELETE(req: NextRequest) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const res = await fetch(`${BOT_URL}/session/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${BOT_SECRET}` },
    })
    const data = await res.json()

    // También limpiar pending_qr si quedó
    await getDb().execute({
      sql: `DELETE FROM wa_auth WHERE key = ?`,
      args: [`pending_qr:${user.id}`],
    })

    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Bot no disponible' }, { status: 503 })
  }
}
