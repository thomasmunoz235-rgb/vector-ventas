export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

// GET /api/whatsapp/status
// Polleado por el frontend cada 30s
// Devuelve: campaña activa + unread replies del vendor logueado
export async function GET(req: NextRequest) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getDb()

  const [campaignResult, unreadResult, sessionResult] = await Promise.all([
    // Campaña activa o la última
    db.execute({
      sql: `SELECT id, total, sent, failed, status, created_at
            FROM wa_campaigns
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 1`,
      args: [user.id],
    }),
    // Replies no leídos
    db.execute({
      sql: `SELECT COUNT(*) as count FROM wa_messages
            WHERE user_id = ? AND direction = 'in' AND read = 0`,
      args: [user.id],
    }),
    // Estado de sesión WA (si hay QR pendiente o creds activos)
    db.execute({
      sql: `SELECT key FROM wa_auth WHERE key IN (?, ?) LIMIT 2`,
      args: [`creds:${user.id}`, `pending_qr:${user.id}`],
    }),
  ])

  const campaign = campaignResult.rows[0] ?? null
  const unreadReplies = Number(unreadResult.rows[0]?.count ?? 0)

  const keys = sessionResult.rows.map((r) => r.key as string)
  const sessionStatus = keys.includes(`creds:${user.id}`)
    ? 'connected'
    : keys.includes(`pending_qr:${user.id}`)
    ? 'awaiting_scan'
    : 'disconnected'

  return NextResponse.json({
    sessionStatus,
    unreadReplies,
    campaign: campaign
      ? {
          id: campaign.id,
          total: campaign.total,
          sent: campaign.sent,
          failed: campaign.failed,
          status: campaign.status,
          createdAt: campaign.created_at,
        }
      : null,
  })
}
