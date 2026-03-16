'use client'

import { useState } from 'react'

type User = {
  id: number
  username: string
  created_at: number | null
}

type Modal =
  | { type: 'create' }
  | { type: 'edit'; user: User }
  | { type: 'delete'; user: User }
  | null

export function UsersManager({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [modal, setModal] = useState<Modal>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Form state
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function openCreate() {
    setUsername('')
    setPassword('')
    setError('')
    setModal({ type: 'create' })
  }

  function openEdit(user: User) {
    setUsername(user.username)
    setPassword('')
    setError('')
    setModal({ type: 'edit', user })
  }

  function openDelete(user: User) {
    setError('')
    setModal({ type: 'delete', user })
  }

  function close() {
    setModal(null)
    setError('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setUsers((prev) => [...prev, data.user])
      close()
    } finally {
      setLoading(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (modal?.type !== 'edit') return
    setLoading(true)
    setError('')
    try {
      const body: Record<string, string> = {}
      if (username.trim() && username !== modal.user.username) body.username = username.trim()
      if (password.trim()) body.password = password.trim()
      if (Object.keys(body).length === 0) { close(); return }

      const res = await fetch(`/api/admin/users/${modal.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === modal.user.id
            ? { ...u, username: body.username ?? u.username }
            : u
        )
      )
      close()
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (modal?.type !== 'delete') return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/users/${modal.user.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      setUsers((prev) => prev.filter((u) => u.id !== modal.user.id))
      close()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Table */}
      <div className="p-6 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white font-semibold text-lg">Usuarios</h1>
            <p className="text-zinc-500 text-xs mt-0.5">{users.length} usuario{users.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={openCreate}
            className="text-xs bg-white text-black px-3 py-1.5 rounded font-medium hover:bg-zinc-200 transition-colors"
          >
            + Nuevo usuario
          </button>
        </div>

        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950">
                <th className="text-left text-zinc-500 font-normal px-4 py-2.5 text-xs">Usuario</th>
                <th className="text-left text-zinc-500 font-normal px-4 py-2.5 text-xs">Creado</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-zinc-900 last:border-0 hover:bg-zinc-950 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm">{user.username}</span>
                      {user.username === 'admin' && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">admin</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs font-mono">
                    {user.created_at
                      ? new Date(user.created_at * 1000).toLocaleDateString('es-AR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end">
                      <button
                        onClick={() => openEdit(user)}
                        className="text-xs text-zinc-500 hover:text-white transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => openDelete(user)}
                        className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                        disabled={user.username === 'admin'}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-zinc-600 text-sm">
                    No hay usuarios
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal backdrop */}
      {modal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <div className="bg-zinc-950 border border-zinc-800 rounded-lg w-full max-w-sm mx-4 p-5">

            {/* Create */}
            {modal.type === 'create' && (
              <form onSubmit={handleCreate} className="space-y-4">
                <h2 className="text-white font-semibold">Nuevo usuario</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-zinc-400 text-xs block mb-1">Usuario</label>
                    <input
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
                      placeholder="nombre_usuario"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs block mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={close} className="flex-1 text-sm text-zinc-400 border border-zinc-700 rounded py-2 hover:border-zinc-500 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading} className="flex-1 text-sm bg-white text-black rounded py-2 font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
                    {loading ? 'Creando...' : 'Crear'}
                  </button>
                </div>
              </form>
            )}

            {/* Edit */}
            {modal.type === 'edit' && (
              <form onSubmit={handleEdit} className="space-y-4">
                <h2 className="text-white font-semibold">Editar usuario</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-zinc-400 text-xs block mb-1">Usuario</label>
                    <input
                      autoFocus
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-zinc-400 text-xs block mb-1">Nueva contraseña <span className="text-zinc-600">(dejar vacío para no cambiar)</span></label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-zinc-500"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={close} className="flex-1 text-sm text-zinc-400 border border-zinc-700 rounded py-2 hover:border-zinc-500 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={loading} className="flex-1 text-sm bg-white text-black rounded py-2 font-medium hover:bg-zinc-200 transition-colors disabled:opacity-50">
                    {loading ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}

            {/* Delete */}
            {modal.type === 'delete' && (
              <div className="space-y-4">
                <h2 className="text-white font-semibold">Eliminar usuario</h2>
                <p className="text-zinc-400 text-sm">
                  ¿Eliminar a <span className="text-white font-mono">{modal.user.username}</span>? Esta acción no se puede deshacer.
                </p>
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={close} className="flex-1 text-sm text-zinc-400 border border-zinc-700 rounded py-2 hover:border-zinc-500 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleDelete} disabled={loading} className="flex-1 text-sm bg-red-600 text-white rounded py-2 font-medium hover:bg-red-500 transition-colors disabled:opacity-50">
                    {loading ? 'Eliminando...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  )
}
