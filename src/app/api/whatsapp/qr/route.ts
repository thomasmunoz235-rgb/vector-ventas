export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromToken } from '@/lib/auth'
import { getDb } from '@/lib/db'
import QRCode from 'qrcode'

// GET /api/whatsapp/qr
// Lee el QR pendiente de Turso y lo convierte a data URL para mostrar como imagen
export async function GET(req: NextRequest) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getDb()
  const result = await db.execute({
    sql: `SELECT value FROM wa_auth WHERE key = ? LIMIT 1`,
    args: [`pending_qr:${user.id}`],
  })

  if (result.rows.length === 0) {
    return NextResponse.json({ qr: null })
  }

  const rawQr = result.rows[0].value as string
  const dataUrl = await QRCode.toDataURL(rawQr, { width: 300, margin: 2 })

  return NextResponse.json({ qr: dataUrl })
}
