export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifySessionToken } from '@/lib/session'

const EDITABLE_COLUMNS = [
  'name', 'address', 'phone', 'website', 'rating',
  'total_ratings', 'category', 'city', 'types', 'status',
  'website_type', 'web_scrape_status', 'email', 'ig_handle', 'contacted',
]

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const token = cookies().get('session')?.value
  const session = token ? await verifySessionToken(token) : null
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { column, value } = body as { column: string; value: string | number }

  if (!EDITABLE_COLUMNS.includes(column)) {
    return NextResponse.json({ error: 'Columna no válida' }, { status: 400 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  const finalValue =
    column === 'rating' || column === 'total_ratings' || column === 'contacted'
      ? value === '' ? null : Number(value)
      : value === '' ? null : value

  try {
    await db.execute({
      sql: `UPDATE businesses SET ${column} = ?, updated_at = ? WHERE id = ?`,
      args: [finalValue, Math.floor(Date.now() / 1000), id],
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DB error:', err)
    return NextResponse.json({ error: 'Error en la base de datos' }, { status: 500 })
  }
}
