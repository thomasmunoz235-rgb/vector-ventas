import { getDb } from '@/lib/db'
import type { Business } from '@/types/business'
import { BusinessesTable } from '@/components/BusinessesTable'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'

const PAGE_SIZE = 200

async function logout() {
  'use server'
  cookies().delete('session')
  redirect('/login')
}

type SearchParams = {
  page?: string
  search?: string
  city?: string
  category?: string
  status?: string
  website_type?: string
  web_scrape_status?: string
  contacted?: string
  in_campaign?: string
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getSessionUser()

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const offset = (page - 1) * PAGE_SIZE
  const search = searchParams.search?.trim() ?? ''
  const city = searchParams.city ?? ''
  const category = searchParams.category ?? ''
  const status = searchParams.status ?? ''
  const website_type = searchParams.website_type ?? ''
  const web_scrape_status = searchParams.web_scrape_status ?? ''
  const contacted = searchParams.contacted ?? ''
  const in_campaign = searchParams.in_campaign ?? ''

  const conditions: string[] = []
  const args: (string | number)[] = []
  if (search) {
    conditions.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR website LIKE ? OR ig_handle LIKE ? OR address LIKE ?)')
    const like = `%${search}%`
    args.push(like, like, like, like, like, like)
  }
  if (city) { conditions.push('city = ?'); args.push(city) }
  if (category) { conditions.push('category = ?'); args.push(category) }
  if (status) { conditions.push('status = ?'); args.push(status) }
  if (website_type) { conditions.push('website_type = ?'); args.push(website_type) }
  if (web_scrape_status) { conditions.push('web_scrape_status = ?'); args.push(web_scrape_status) }
  if (contacted === '1' || contacted === '0') { conditions.push('contacted = ?'); args.push(Number(contacted)) }
  if (in_campaign === '1' && user) {
    conditions.push(`id IN (
      SELECT m.business_id FROM wa_messages m
      JOIN wa_campaigns c ON m.campaign_id = c.id
      WHERE c.user_id = ? AND c.status IN ('pending', 'running') AND m.status = 'pending'
    )`)
    args.push(user.id)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const [result, countResult, uniqueResult] = await Promise.all([
    getDb().execute({
      sql: `SELECT id, place_id, name, address, phone, website, rating, total_ratings, category, city, types, status, website_type, web_scrape_status, email, ig_handle, contacted, created_at, updated_at FROM businesses ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      args: [...args, PAGE_SIZE, offset],
    }),
    getDb().execute({ sql: `SELECT COUNT(*) as total FROM businesses ${where}`, args }),
    getDb().execute(`
      SELECT
        GROUP_CONCAT(DISTINCT city) as cities,
        GROUP_CONCAT(DISTINCT category) as categories,
        GROUP_CONCAT(DISTINCT status) as statuses,
        GROUP_CONCAT(DISTINCT website_type) as website_types,
        GROUP_CONCAT(DISTINCT web_scrape_status) as web_scrape_statuses
      FROM businesses
    `),
  ])

  const total = Number(countResult.rows[0].total)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const uRow = uniqueResult.rows[0]
  const split = (v: unknown) => (v ? String(v).split(',').filter(Boolean).sort() : [])
  const uniqueValues = {
    cities: split(uRow.cities),
    categories: split(uRow.categories),
    statuses: split(uRow.statuses),
    website_types: split(uRow.website_types),
    web_scrape_statuses: split(uRow.web_scrape_statuses),
  }

  const businesses: Business[] = result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as number,
    place_id: (row.place_id as string) ?? null,
    name: (row.name as string) ?? null,
    address: (row.address as string) ?? null,
    phone: (row.phone as string) ?? null,
    website: (row.website as string) ?? null,
    rating: (row.rating as number) ?? null,
    total_ratings: (row.total_ratings as number) ?? null,
    category: (row.category as string) ?? null,
    city: (row.city as string) ?? null,
    types: (row.types as string) ?? null,
    status: (row.status as string) ?? null,
    website_type: (row.website_type as string) ?? null,
    web_scrape_status: (row.web_scrape_status as string) ?? null,
    email: (row.email as string) ?? null,
    ig_handle: (row.ig_handle as string) ?? null,
    contacted: (row.contacted as number) ?? 0,
    created_at: (row.created_at as number) ?? null,
    updated_at: (row.updated_at as number) ?? null,
  }))

  const filters = { search, city, category, status, website_type, web_scrape_status, contacted, in_campaign }

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      <nav className="flex-shrink-0 border-b border-zinc-900 px-5 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="white" />
            <path d="M10 24L16 10L22 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12.5 19H19.5" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="text-white font-semibold text-sm tracking-tight">Vector</span>
          <span className="text-zinc-700 text-xs">/</span>
          <span className="text-zinc-400 text-sm">Ventas</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="text-zinc-600 text-xs font-mono">{total.toLocaleString('es')} registros</span>
          <a href="/dashboard/whatsapp" className="text-xs text-zinc-500 hover:text-white transition-colors">WhatsApp</a>
          {user?.username === 'admin' && (
            <a href="/dashboard/admin/users" className="text-xs text-zinc-500 hover:text-white transition-colors">Usuarios</a>
          )}
          <form action={logout}>
            <button type="submit" className="text-xs text-zinc-500 hover:text-white transition-colors">Salir →</button>
          </form>
        </div>
      </nav>
      <div className="flex-1 overflow-hidden">
        <BusinessesTable
          initialData={businesses}
          filters={filters}
          uniqueValues={uniqueValues}
          pagination={{ page, totalPages, total, pageSize: PAGE_SIZE }}
        />
      </div>
    </div>
  )
}
