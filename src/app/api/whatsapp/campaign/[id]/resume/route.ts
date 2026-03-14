export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

// POST /api/whatsapp/campaign/:id/resume
// Reanuda una campaña pausada (paused → running)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const campaignId = parseInt(params.id)
  if (isNaN(campaignId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const result = await getDb().execute({
    sql: `UPDATE wa_campaigns SET status = 'running'
          WHERE id = ? AND user_id = ? AND status = 'paused'`,
    args: [campaignId, user.id],
  })

  if (result.rowsAffected === 0) {
    return NextResponse.json({ error: 'Campaña no encontrada o no está pausada' }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
