'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
      })
      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(res.status === 401 ? 'Usuario o contraseña incorrectos' : `Error del servidor (${res.status}): ${data.error ?? 'desconocido'}`)
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-12">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="white" />
            <path
              d="M10 24L16 10L22 24"
              stroke="black"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M12.5 19H19.5" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="text-white font-semibold text-lg tracking-tight">Vector</span>
          <span className="text-zinc-700 text-sm">/ Ventas</span>
        </div>

        <h1 className="text-white text-2xl font-bold tracking-tight mb-2">Iniciar sesión</h1>
        <p className="text-zinc-500 text-sm mb-8">Accedé al panel de gestión</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block font-medium">
              Usuario
            </label>
            <input
              type="text"
              value={user}
              onChange={e => setUser(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className="w-full bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded text-sm outline-none focus:border-zinc-600 transition-colors placeholder-zinc-700"
              placeholder="usuario"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block font-medium">
              Contraseña
            </label>
            <input
              type="password"
              value={pass}
              onChange={e => setPass(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded text-sm outline-none focus:border-zinc-600 transition-colors placeholder-zinc-700"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs text-center bg-red-500/5 border border-red-500/20 rounded py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-semibold py-3 rounded text-sm hover:opacity-90 transition-opacity disabled:opacity-40 mt-2"
          >
            {loading ? 'Ingresando...' : 'Ingresar →'}
          </button>
        </form>
      </div>
    </div>
  )
}
