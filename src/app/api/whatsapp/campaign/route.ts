export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromToken } from '@/lib/auth'
import { getDb } from '@/lib/db'

// POST /api/whatsapp/campaign
// Crea una campaña e inserta los mensajes en la cola (status=pending)
// Body: { businessIds: number[], templateOverride?: string }
export async function POST(req: NextRequest) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { name, businessIds, templateOverride, cargoOverride, nombreUsuarioOverride } = await req.json()
  if (!Array.isArray(businessIds) || businessIds.length === 0) {
    return NextResponse.json({ error: 'businessIds requerido' }, { status: 400 })
  }

  const db = getDb()

  // Template
  const templateRow = await db.execute({
    sql: `SELECT body, cargo FROM wa_template WHERE user_id = ? LIMIT 1`,
    args: [user.id],
  })
  const FIRMA = '\n\n🌐 https://vector-ia.com.ar/\n📧 team@vector-ia.com.ar'

  const templateBody = templateOverride ?? (templateRow.rows[0]?.body as string) ?? 'Hola {nombre}, te contactamos desde Vector-IA.'
  const userCargo = cargoOverride ?? (templateRow.rows[0]?.cargo as string) ?? ''

  // Obtener negocios con teléfono válido que no estén en otra campaña activa
  const placeholders = businessIds.map(() => '?').join(',')
  const bizResult = await db.execute({
    sql: `SELECT id, name, phone FROM businesses
          WHERE id IN (${placeholders}) AND phone IS NOT NULL AND trim(phone) != ''
          AND id NOT IN (
            SELECT m.business_id FROM wa_messages m
            JOIN wa_campaigns c ON m.campaign_id = c.id
            WHERE c.user_id = ? AND c.status IN ('pending', 'running') AND m.status = 'pending'
          )`,
    args: [...businessIds, user.id],
  })

  if (bizResult.rows.length === 0) {
    return NextResponse.json({ error: 'Ningún negocio seleccionado tiene teléfono válido o todos ya pertenecen a una campaña activa' }, { status: 400 })
  }

  const now = Math.floor(Date.now() / 1000)

  // Crear campaña
  const campaignResult = await db.execute({
    sql: `INSERT INTO wa_campaigns (user_id, name, template_body, total, status, created_at)
          VALUES (?, ?, ?, ?, 'pending', ?) RETURNING id`,
    args: [user.id, name ?? 'Sin nombre', templateBody, bizResult.rows.length, now],
  })
  const campaignId = campaignResult.rows[0].id as number

  // Insertar mensajes en cola (batch — un solo round-trip)
  await db.batch(
    bizResult.rows.map((row) => {
      const bizName = (row.name as string) ?? ''
      const phone = row.phone as string
      const body = templateBody
        .replace(/\{nombre\}/gi, bizName)
        .replace(/\{negocio\}/gi, bizName)
        .replace(/\{nombre de la empresa\}/gi, 'Vector-IA')
        .replace(/\{nombre del usuario\}/gi, nombreUsuarioOverride ?? user.username)
        .replace(/\{cargo\}/gi, userCargo)
        + FIRMA
      return {
        sql: `INSERT INTO wa_messages (user_id, business_id, campaign_id, phone, direction, body, status, created_at)
              VALUES (?, ?, ?, ?, 'out', ?, 'pending', ?)`,
        args: [user.id, row.id, campaignId, phone, body, now],
      }
    })
  )

  return NextResponse.json({ ok: true, campaignId, total: bizResult.rows.length })
}

// GET /api/whatsapp/campaign
// Lista las últimas campañas del vendor
export async function GET(req: NextRequest) {
  const user = await getSessionUserFromToken(req.cookies.get('session')?.value)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const result = await getDb().execute({
    sql: `SELECT id, name, template_body, total, sent, failed, status, created_at
          FROM wa_campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    args: [user.id],
  })

  return NextResponse.json({ campaigns: result.rows })
}
