import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { WhatsAppPanel } from '@/components/WhatsAppPanel'

export default async function WhatsAppPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const db = getDb()

  const [templateResult, campaignsResult, sessionResult] = await Promise.all([
    db.execute({
      sql: `SELECT body FROM wa_template WHERE user_id = ? LIMIT 1`,
      args: [user.id],
    }),
    db.execute({
      sql: `SELECT id, name, template_body, total, sent, failed, status, created_at
            FROM wa_campaigns WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
      args: [user.id],
    }),
    db.execute({
      sql: `SELECT key FROM wa_auth WHERE key IN (?, ?)`,
      args: [`creds:${user.id}`, `pending_qr:${user.id}`],
    }),
  ])

  const template = (templateResult.rows[0]?.body as string) ?? 'Hola {nombre}, te contactamos desde Vector-IA.'

  const campaigns = campaignsResult.rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    templateBody: r.template_body as string,
    total: r.total as number,
    sent: r.sent as number,
    failed: r.failed as number,
    status: r.status as string,
    createdAt: r.created_at as number,
  }))

  const keys = sessionResult.rows.map((r) => r.key as string)
  const sessionStatus = keys.includes(`creds:${user.id}`)
    ? 'connected'
    : keys.includes(`pending_qr:${user.id}`)
    ? 'awaiting_scan'
    : 'disconnected'

  return (
    <WhatsAppPanel
      initialTemplate={template}
      initialCampaigns={campaigns}
      initialSessionStatus={sessionStatus}
    />
  )
}
