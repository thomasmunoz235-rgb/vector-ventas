export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

// POST /api/whatsapp/campaign/:id/start
// Marca la campaña como 'running' para que el bot la procese
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const campaignId = parseInt(params.id)
  if (isNaN(campaignId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const db = getDb()

  // Verificar que la campaña pertenece al usuario y está en estado 'pending'
  const row = await db.execute({
    sql: `SELECT id, status FROM wa_campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
    args: [campaignId, user.id],
  })

  if (row.rows.length === 0) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  }

  const status = row.rows[0].status as string
  if (status !== 'pending') {
    return NextResponse.json({ error: `La campaña está en estado '${status}', no se puede iniciar` }, { status: 409 })
  }

  await db.execute({
    sql: `UPDATE wa_campaigns SET status = 'running' WHERE id = ?`,
    args: [campaignId],
  })

  return NextResponse.json({ ok: true })
}
