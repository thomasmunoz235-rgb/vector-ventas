export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

// DELETE /api/whatsapp/campaign/:id
// Elimina una campaña pausada o finalizada junto con sus mensajes
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const campaignId = parseInt(params.id)
  if (isNaN(campaignId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const db = getDb()

  // Solo se pueden eliminar campañas pausadas o finalizadas (no running/pending)
  const row = await db.execute({
    sql: `SELECT status FROM wa_campaigns WHERE id = ? AND user_id = ? LIMIT 1`,
    args: [campaignId, user.id],
  })

  if (row.rows.length === 0) {
    return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 })
  }

  const status = row.rows[0].status as string
  if (status === 'running' || status === 'pending') {
    return NextResponse.json({ error: 'No se puede eliminar una campaña activa. Cancelala primero.' }, { status: 409 })
  }

  await db.batch([
    { sql: `DELETE FROM wa_messages WHERE campaign_id = ?`, args: [campaignId] },
    { sql: `DELETE FROM wa_campaigns WHERE id = ? AND user_id = ?`, args: [campaignId, user.id] },
  ])

  return NextResponse.json({ ok: true })
}
