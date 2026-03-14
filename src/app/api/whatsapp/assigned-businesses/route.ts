export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

// GET /api/whatsapp/assigned-businesses
// Devuelve { [businessId]: campaignName } para negocios en campañas activas (pending/running)
export async function GET(req: NextRequest) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const result = await getDb().execute({
    sql: `SELECT m.business_id, c.name as campaign_name
          FROM wa_messages m
          JOIN wa_campaigns c ON m.campaign_id = c.id
          WHERE c.user_id = ? AND c.status IN ('pending', 'running') AND m.status = 'pending'
          GROUP BY m.business_id`,
    args: [user.id],
  })

  const assigned: Record<number, string> = {}
  for (const row of result.rows) {
    assigned[row.business_id as number] = row.campaign_name as string
  }

  return NextResponse.json({ assigned })
}
