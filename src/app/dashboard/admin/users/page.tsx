import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { UsersManager } from '@/components/UsersManager'

async function logout() {
  'use server'
  cookies().delete('session')
  redirect('/login')
}

export default async function AdminUsersPage() {
  const user = await getSessionUser()
  if (!user || user.username !== 'admin') redirect('/dashboard')

  const result = await getDb().execute({
    sql: 'SELECT id, username, created_at FROM users ORDER BY id ASC',
    args: [],
  })

  const users = result.rows.map((r) => ({
    id: r.id as number,
    username: r.username as string,
    created_at: (r.created_at as number) ?? null,
  }))

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
          <a href="/dashboard" className="text-zinc-400 text-sm hover:text-white transition-colors">Ventas</a>
          <span className="text-zinc-700 text-xs">/</span>
          <span className="text-zinc-400 text-sm">Usuarios</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="/dashboard/whatsapp" className="text-xs text-zinc-500 hover:text-white transition-colors">WhatsApp</a>
          <form action={logout}>
            <button type="submit" className="text-xs text-zinc-500 hover:text-white transition-colors">Salir →</button>
          </form>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <UsersManager initialUsers={users} />
      </div>
    </div>
  )
}
