'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Campaign = {
  id: number
  name: string
  templateBody: string
  total: number
  sent: number
  failed: number
  status: string
  createdAt: number
}

type SessionStatus = 'connected' | 'awaiting_scan' | 'disconnected'

type Props = {
  initialTemplate: string
  initialCampaigns: Campaign[]
  initialSessionStatus: SessionStatus
}

export function WhatsAppPanel({ initialTemplate, initialCampaigns, initialSessionStatus }: Props) {
  const [template, setTemplate] = useState(initialTemplate)
  const [savedTemplate, setSavedTemplate] = useState(initialTemplate)
  const [campaigns, setCampaigns] = useState(initialCampaigns)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(initialSessionStatus)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [startingCampaign, setStartingCampaign] = useState<number | null>(null)
  const [cancellingCampaign, setCancellingCampaign] = useState<number | null>(null)
  const [resumingCampaign, setResumingCampaign] = useState<number | null>(null)
  const [deletingCampaign, setDeletingCampaign] = useState<number | null>(null)
  const [tab, setTab] = useState<'session' | 'campaigns'>('session')

  // Polling cada 30s para status
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status')
      if (!res.ok) return
      const data = await res.json()
      setSessionStatus(data.sessionStatus)
      if (data.campaign) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === data.campaign.id ? { ...c, ...data.campaign } : c))
        )
      }
    } catch {}
  }, [])

  // Polling QR cuando está en awaiting_scan
  const pollQr = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/qr')
      if (!res.ok) return
      const data = await res.json()
      if (data.qr) setQrImage(data.qr)
    } catch {}
  }, [])

  useEffect(() => {
    const interval = setInterval(pollStatus, 30000)
    return () => clearInterval(interval)
  }, [pollStatus])

  useEffect(() => {
    if (sessionStatus !== 'awaiting_scan') {
      setQrImage(null)
      return
    }
    pollQr()
    const interval = setInterval(pollQr, 5000)
    return () => clearInterval(interval)
  }, [sessionStatus, pollQr])

  async function handleConnect() {
    setConnecting(true)
    try {
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' })
      const data = await res.json()
      if (data.status === 'already_connected') {
        setSessionStatus('connected')
      } else if (data.status === 'qr_generated') {
        setSessionStatus('awaiting_scan')
      }
    } catch {}
    setConnecting(false)
  }

  async function handleDisconnect() {
    if (!confirm('¿Desconectar WhatsApp?')) return
    try {
      await fetch('/api/whatsapp/connect', { method: 'DELETE' })
      setSessionStatus('disconnected')
      setQrImage(null)
    } catch {}
  }

  async function handleSaveTemplate() {
    setSavingTemplate(true)
    try {
      await fetch('/api/whatsapp/template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: template }),
      })
      setSavedTemplate(template)
    } catch {}
    setSavingTemplate(false)
  }

  async function handleStartCampaign(id: number) {
    setStartingCampaign(id)
    try {
      const res = await fetch(`/api/whatsapp/campaign/${id}/start`, { method: 'POST' })
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: 'running' } : c))
        )
      }
    } catch {}
    setStartingCampaign(null)
  }

  async function handleCancelCampaign(id: number) {
    if (!confirm('¿Cancelar la campaña? Los mensajes pendientes no se enviarán.')) return
    setCancellingCampaign(id)
    try {
      const res = await fetch(`/api/whatsapp/campaign/${id}/cancel`, { method: 'POST' })
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: 'paused' } : c))
        )
      }
    } catch {}
    setCancellingCampaign(null)
  }

  async function handleResumeCampaign(id: number) {
    setResumingCampaign(id)
    try {
      const res = await fetch(`/api/whatsapp/campaign/${id}/resume`, { method: 'POST' })
      if (res.ok) {
        setCampaigns((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: 'running' } : c))
        )
      }
    } catch {}
    setResumingCampaign(null)
  }

  async function handleDeleteCampaign(id: number) {
    if (!confirm('¿Eliminar esta campaña? Se borrarán todos sus mensajes.')) return
    setDeletingCampaign(id)
    try {
      const res = await fetch(`/api/whatsapp/campaign/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCampaigns((prev) => prev.filter((c) => c.id !== id))
      }
    } catch {}
    setDeletingCampaign(null)
  }

  const templateChanged = template !== savedTemplate

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Nav */}
      <nav className="flex-shrink-0 border-b border-zinc-900 px-5 h-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="white" />
            <path d="M10 24L16 10L22 24" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12.5 19H19.5" stroke="black" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="text-white font-semibold text-sm tracking-tight">Vector</span>
          <span className="text-zinc-700 text-xs">/</span>
          <Link href="/dashboard" className="text-zinc-400 text-sm hover:text-white transition-colors">Ventas</Link>
          <span className="text-zinc-700 text-xs">/</span>
          <span className="text-zinc-400 text-sm">WhatsApp</span>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-5 py-8 space-y-8">

          {/* Tabs */}
          <div className="flex gap-1 border-b border-zinc-900">
            {(['session', 'campaigns'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm transition-colors ${
                  tab === t
                    ? 'text-white border-b border-white -mb-px'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'session' ? 'Sesión' : 'Campañas'}
              </button>
            ))}
          </div>

          {/* Tab: Sesión */}
          {tab === 'session' && (
            <div className="space-y-6">
              {/* Estado de conexión */}
              <div className="border border-zinc-900 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-medium">Conexión WhatsApp</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {sessionStatus === 'connected' && 'Sesión activa'}
                      {sessionStatus === 'awaiting_scan' && 'Esperando escaneo del QR'}
                      {sessionStatus === 'disconnected' && 'Sin conexión'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      sessionStatus === 'connected' ? 'bg-emerald-500' :
                      sessionStatus === 'awaiting_scan' ? 'bg-yellow-500 animate-pulse' :
                      'bg-zinc-700'
                    }`} />
                    <span className={`text-xs font-mono ${
                      sessionStatus === 'connected' ? 'text-emerald-500' :
                      sessionStatus === 'awaiting_scan' ? 'text-yellow-500' :
                      'text-zinc-600'
                    }`}>
                      {sessionStatus === 'connected' ? 'conectado' :
                       sessionStatus === 'awaiting_scan' ? 'esperando' : 'desconectado'}
                    </span>
                  </div>
                </div>

                {sessionStatus === 'disconnected' && (
                  <button
                    onClick={handleConnect}
                    disabled={connecting}
                    className="w-full py-2 text-sm bg-white text-black rounded-md hover:bg-zinc-100 transition-colors disabled:opacity-50"
                  >
                    {connecting ? 'Iniciando...' : 'Conectar WhatsApp'}
                  </button>
                )}

                {sessionStatus === 'connected' && (
                  <button
                    onClick={handleDisconnect}
                    className="w-full py-2 text-sm border border-zinc-800 text-zinc-400 rounded-md hover:text-white hover:border-zinc-600 transition-colors"
                  >
                    Desconectar
                  </button>
                )}
              </div>

              {/* QR */}
              {sessionStatus === 'awaiting_scan' && (
                <div className="border border-zinc-900 rounded-lg p-5 space-y-3">
                  <p className="text-white text-sm font-medium">Escaneá el código QR</p>
                  <p className="text-zinc-500 text-xs">Abrí WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                  {qrImage ? (
                    <div className="flex justify-center">
                      <img src={qrImage} alt="QR WhatsApp" className="w-48 h-48 rounded-md" />
                    </div>
                  ) : (
                    <div className="flex justify-center items-center h-48 text-zinc-600 text-xs">
                      Generando QR...
                    </div>
                  )}
                </div>
              )}

              {/* Template */}
              <div className="border border-zinc-900 rounded-lg p-5 space-y-3">
                <div>
                  <p className="text-white text-sm font-medium">Mensaje de campaña</p>
                  <p className="text-zinc-500 text-xs mt-0.5">
                    Variables: <code className="text-zinc-400">{'{nombre}'}</code> · <code className="text-zinc-400">{'{nombre de la empresa}'}</code> · <code className="text-zinc-400">{'{nombre del usuario}'}</code> · <code className="text-zinc-400">{'{cargo}'}</code>
                  </p>
                </div>
                <textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700"
                  placeholder="Hola {nombre}, te contactamos desde Vector-IA."
                />
                {templateChanged && (
                  <button
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="px-4 py-1.5 text-xs bg-white text-black rounded-md hover:bg-zinc-100 transition-colors disabled:opacity-50"
                  >
                    {savingTemplate ? 'Guardando...' : 'Guardar template'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab: Campañas */}
          {tab === 'campaigns' && (
            <div className="space-y-4">
              {campaigns.length === 0 ? (
                <div className="border border-zinc-900 rounded-lg p-8 text-center">
                  <p className="text-zinc-500 text-sm">No hay campañas todavía</p>
                  <p className="text-zinc-700 text-xs mt-1">Creá una campaña desde la tabla de negocios seleccionando contactos</p>
                </div>
              ) : (
                campaigns.map((c) => (
                  <div key={c.id} className="border border-zinc-900 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            c.status === 'done' ? 'bg-emerald-500' :
                            c.status === 'running' ? 'bg-blue-500 animate-pulse' :
                            c.status === 'error' ? 'bg-red-500' :
                            c.status === 'paused' ? 'bg-yellow-500' :
                            'bg-zinc-600'
                          }`} />
                          <span className="text-white text-sm font-medium">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-3.5">
                          <span className="text-zinc-700 text-xs font-mono">#{c.id}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                            c.status === 'done' ? 'bg-emerald-950 text-emerald-500' :
                            c.status === 'running' ? 'bg-blue-950 text-blue-400' :
                            c.status === 'error' ? 'bg-red-950 text-red-400' :
                            c.status === 'paused' ? 'bg-yellow-950 text-yellow-500' :
                            'bg-zinc-900 text-zinc-500'
                          }`}>
                            {c.status === 'pending' ? 'pendiente' :
                             c.status === 'running' ? 'en curso' :
                             c.status === 'done' ? 'finalizada' :
                             c.status === 'paused' ? 'pausada' :
                             c.status === 'error' ? 'error' : c.status}
                          </span>
                        </div>
                      </div>
                      <span className="text-zinc-600 text-xs font-mono flex-shrink-0">
                        {new Date(c.createdAt * 1000).toLocaleDateString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Barra de progreso */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{c.sent} enviados</span>
                        <span>{c.total} total</span>
                      </div>
                      <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-500"
                          style={{ width: c.total > 0 ? `${(c.sent / c.total) * 100}%` : '0%' }}
                        />
                      </div>
                      {c.failed > 0 && (
                        <p className="text-red-500 text-xs">{c.failed} fallidos</p>
                      )}
                    </div>

                    <p className="text-zinc-700 text-xs truncate italic">{c.templateBody}</p>

                    <div className="flex gap-2">
                      {c.status === 'pending' && (
                        <button
                          onClick={() => handleStartCampaign(c.id)}
                          disabled={startingCampaign === c.id}
                          className="flex-1 py-1.5 text-xs bg-white text-black rounded-md hover:bg-zinc-100 transition-colors disabled:opacity-50"
                        >
                          {startingCampaign === c.id ? 'Iniciando...' : 'Enviar campaña'}
                        </button>
                      )}
                      {c.status === 'paused' && (
                        <button
                          onClick={() => handleResumeCampaign(c.id)}
                          disabled={resumingCampaign === c.id}
                          className="flex-1 py-1.5 text-xs bg-white text-black rounded-md hover:bg-zinc-100 transition-colors disabled:opacity-50"
                        >
                          {resumingCampaign === c.id ? 'Reanudando...' : 'Reanudar campaña'}
                        </button>
                      )}
                      {(c.status === 'pending' || c.status === 'running') && (
                        <button
                          onClick={() => handleCancelCampaign(c.id)}
                          disabled={cancellingCampaign === c.id}
                          className="px-3 py-1.5 text-xs border border-zinc-800 text-zinc-500 rounded-md hover:border-red-900 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {cancellingCampaign === c.id ? '...' : 'Cancelar'}
                        </button>
                      )}
                      {(c.status === 'paused' || c.status === 'done') && (
                        <button
                          onClick={() => handleDeleteCampaign(c.id)}
                          disabled={deletingCampaign === c.id}
                          className="px-3 py-1.5 text-xs border border-zinc-800 text-zinc-500 rounded-md hover:border-red-900 hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                          {deletingCampaign === c.id ? '...' : 'Eliminar'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
