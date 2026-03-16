'use client'

import { useState, useCallback, useEffect, useRef, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
  type RowData,
} from '@tanstack/react-table'
import type { Business } from '@/types/business'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    updateData: (rowId: string, columnId: string, value: string | number) => Promise<void>
  }
}

// ─── Editable Cell ───────────────────────────────────────────────────────────

function EditableCell({
  rowId,
  columnId,
  externalValue,
  onSave,
}: {
  rowId: string
  columnId: string
  externalValue: unknown
  onSave: (rowId: string, columnId: string, value: string | number) => Promise<void>
}) {
  const str = externalValue != null ? String(externalValue) : ''
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(str)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isEditing) setValue(str)
  }, [str, isEditing])

  const startEdit = () => {
    setValue(str)
    setIsEditing(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  const save = async () => {
    setIsEditing(false)
    if (value === str) return
    setSaving(true)
    await onSave(rowId, columnId, value)
    setSaving(false)
  }

  const cancel = () => {
    setValue(str)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') cancel()
        }}
        className="w-full min-w-[100px] bg-zinc-900 border border-zinc-500 rounded px-2 py-0.5 text-sm text-white outline-none"
      />
    )
  }

  return (
    <span
      onDoubleClick={startEdit}
      title={str || undefined}
      className={`block truncate max-w-[200px] cursor-text select-none transition-opacity ${
        saving ? 'opacity-30' : ''
      } ${!str ? 'text-zinc-700' : 'text-zinc-300 hover:text-white'}`}
    >
      {str || '—'}
    </span>
  )
}

// ─── Row Popup ────────────────────────────────────────────────────────────────

function RowPopup({
  business,
  onClose,
  onToggleContacted,
}: {
  business: Business
  onClose: () => void
  onToggleContacted: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const isContacted = Boolean(business.contacted)

  const handleToggle = async () => {
    setLoading(true)
    await onToggleContacted()
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-white font-semibold text-base leading-tight">
              {business.name ?? '—'}
            </h2>
            {business.category && (
              <p className="text-zinc-500 text-xs mt-0.5">{business.category}</p>
            )}
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors text-lg leading-none ml-4">✕</button>
        </div>

        {/* Details */}
        <div className="space-y-2.5 mb-6">
          {[
            ['Ciudad', business.city],
            ['Teléfono', business.phone],
            ['Email', business.email],
            ['Website', business.website],
            ['Instagram', business.ig_handle ? `@${business.ig_handle}` : null],
            ['Dirección', business.address],
            ['Estado', business.status],
            ['Rating', business.rating != null ? `${business.rating.toFixed(1)} (${business.total_ratings ?? 0} reviews)` : null],
          ].map(([label, val]) =>
            val ? (
              <div key={label as string} className="flex gap-3 text-sm">
                <span className="text-zinc-600 w-20 flex-shrink-0">{label}</span>
                <span className="text-zinc-300 break-all">{val}</span>
              </div>
            ) : null
          )}
        </div>

        {/* Contactado button */}
        <button
          onClick={handleToggle}
          disabled={loading}
          className={`w-full py-2.5 rounded text-sm font-medium transition-all disabled:opacity-50 ${
            isContacted
              ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-zinc-700'
              : 'bg-white text-black hover:bg-zinc-200'
          }`}
        >
          {loading ? '...' : isContacted ? '✓ Contactado — marcar como no contactado' : 'Marcar como contactado'}
        </button>
      </div>
    </div>
  )
}

// ─── Column definitions ───────────────────────────────────────────────────────

const ch = createColumnHelper<Business>()

function makeEditable(id: keyof Business, header: string, size = 160) {
  return ch.accessor(id, {
    header,
    size,
    cell: info => (
      <EditableCell
        rowId={info.row.id}
        columnId={info.column.id}
        externalValue={info.getValue()}
        onSave={info.table.options.meta!.updateData}
      />
    ),
  })
}

const columns = [
  ch.accessor('id', {
    header: 'ID',
    size: 64,
    cell: info => <span className="text-zinc-600 font-mono text-xs">{info.getValue()}</span>,
  }),
  ch.accessor('contacted', {
    header: 'Contactado',
    size: 100,
    cell: info => (
      info.getValue()
        ? <span className="inline-flex items-center gap-1.5 text-xs text-green-400 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />Sí</span>
        : <span className="text-xs text-zinc-700">No</span>
    ),
  }),
  makeEditable('name', 'Nombre', 200),
  makeEditable('phone', 'Teléfono', 140),
  makeEditable('email', 'Email', 190),
  makeEditable('website', 'Website', 190),
  makeEditable('ig_handle', 'Instagram', 150),
  ch.accessor('rating', {
    header: 'Rating',
    size: 80,
    cell: info => {
      const v = info.getValue()
      if (v == null) return <span className="text-zinc-700">—</span>
      const cls = v >= 4 ? 'text-green-400' : v >= 3 ? 'text-yellow-400' : 'text-red-400'
      return <span className={cls}>{v.toFixed(1)}</span>
    },
  }),
  ch.accessor('total_ratings', {
    header: 'Reviews',
    size: 80,
    cell: info => <span className="text-zinc-500">{info.getValue() ?? '—'}</span>,
  }),
  makeEditable('category', 'Categoría', 160),
  makeEditable('city', 'Ciudad', 120),
  makeEditable('status', 'Estado', 120),
  makeEditable('website_type', 'Tipo Web', 120),
  makeEditable('web_scrape_status', 'Scrape', 110),
  makeEditable('address', 'Dirección', 220),
  ch.accessor('types', {
    header: 'Types',
    size: 160,
    cell: info => <span className="text-zinc-600 text-xs truncate block max-w-[150px]">{info.getValue() ?? '—'}</span>,
  }),
  ch.accessor('place_id', {
    header: 'Place ID',
    size: 150,
    cell: info => <span className="text-zinc-700 font-mono text-xs">{info.getValue() ?? '—'}</span>,
  }),
  ch.accessor('created_at', {
    header: 'Creado',
    size: 95,
    cell: info => {
      const v = info.getValue()
      return <span className="text-zinc-600 text-xs">{v ? new Date(Number(v) * 1000).toLocaleDateString('es-AR') : '—'}</span>
    },
  }),
  ch.accessor('updated_at', {
    header: 'Actualizado',
    size: 95,
    cell: info => {
      const v = info.getValue()
      return <span className="text-zinc-600 text-xs">{v ? new Date(Number(v) * 1000).toLocaleDateString('es-AR') : '—'}</span>
    },
  }),
]

// ─── New Business Modal ───────────────────────────────────────────────────────

function NewBusinessModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', category: '', city: '', email: '', website: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSubmit() {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear'); setSaving(false); return }
      onCreated()
    } catch {
      setError('Error de red')
      setSaving(false)
    }
  }

  const fields: [string, string, string][] = [
    ['name', 'Nombre *', 'Ej: La Pizzería de Juan'],
    ['phone', 'Teléfono', 'Ej: 5491112345678'],
    ['category', 'Categoría', 'Ej: Restaurante'],
    ['city', 'Ciudad', 'Ej: Buenos Aires'],
    ['email', 'Email', 'Ej: contacto@local.com'],
    ['website', 'Website', 'Ej: https://local.com'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900">
          <h2 className="text-white text-sm font-semibold">Nuevo local</h2>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {fields.map(([key, label, placeholder]) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-zinc-500">{label}</label>
              <input
                value={form[key as keyof typeof form]}
                onChange={e => set(key, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder={placeholder}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700"
              />
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-zinc-900 space-y-2">
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full py-2 text-sm bg-white text-black rounded-md hover:bg-zinc-100 transition-colors disabled:opacity-50 font-medium"
          >
            {saving ? 'Creando...' : 'Crear local'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Campaign Modal ───────────────────────────────────────────────────────────

function CampaignModal({
  businesses,
  onClose,
  onCreated,
}: {
  businesses: Business[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [template, setTemplate] = useState('')
  const [cargo, setCargo] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [loadingTemplate, setLoadingTemplate] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const FIRMA = '\n\n🌐 https://vector-ia.com.ar/\n📧 team@vector-ia.com.ar'

  useEffect(() => {
    fetch('/api/whatsapp/template')
      .then(r => r.json())
      .then(d => {
        setTemplate(d.body ?? '')
        setCargo(d.cargo ?? '')
        setNombreUsuario(d.username ?? '')
        setLoadingTemplate(false)
      })
      .catch(() => setLoadingTemplate(false))
  }, [])

  const preview = (bizName: string) =>
    template
      .replace(/\{nombre\}/gi, bizName)
      .replace(/\{negocio\}/gi, bizName)
      .replace(/\{nombre de la empresa\}/gi, 'Vector-IA')
      .replace(/\{nombre del usuario\}/gi, nombreUsuario)
      .replace(/\{cargo\}/gi, cargo)
      + FIRMA

  function renderWhatsAppText(text: string) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const html = escaped
      .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/~(.*?)~/g, '<del>$1</del>')
      .replace(/\n/g, '<br>')
    return { __html: html }
  }

  const withPhone = businesses.filter(b => b.phone)
  const withoutPhone = businesses.filter(b => !b.phone)

  async function handleCreate() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/whatsapp/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Sin nombre',
          businessIds: withPhone.map(b => b.id),
          templateOverride: template,
          cargoOverride: cargo,
          nombreUsuarioOverride: nombreUsuario,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al crear campaña'); setCreating(false); return }
      onCreated()
    } catch {
      setError('Error de red')
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-900">
          <div>
            <h2 className="text-white text-sm font-semibold">Nueva campaña WA</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              {withPhone.length} con teléfono
              {withoutPhone.length > 0 && <span className="text-zinc-700"> · {withoutPhone.length} sin teléfono (se omiten)</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Nombre de campaña */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">Nombre de campaña</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Restaurantes CABA mayo"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700"
            />
          </div>

          {/* Template */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">Mensaje</label>
            {loadingTemplate ? (
              <div className="h-20 bg-zinc-900 rounded-md animate-pulse" />
            ) : (
              <textarea
                value={template}
                onChange={e => setTemplate(e.target.value)}
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-zinc-600"
              />
            )}
            <p className="text-zinc-700 text-xs">
              Variables: <code className="text-zinc-500">{'{nombre}'}</code> · <code className="text-zinc-500">{'{nombre de la empresa}'}</code> · <code className="text-zinc-500">{'{nombre del usuario}'}</code> · <code className="text-zinc-500">{'{cargo}'}</code>
            </p>
            <div className="pt-1 grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider">Tu nombre</label>
                <input
                  value={nombreUsuario}
                  onChange={e => setNombreUsuario(e.target.value)}
                  placeholder="Ej: Agustín"
                  className="mt-1.5 w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 uppercase tracking-wider">Tu cargo</label>
                <input
                  value={cargo}
                  onChange={e => setCargo(e.target.value)}
                  placeholder="Ej: Asesor comercial"
                  className="mt-1.5 w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-600 placeholder:text-zinc-700"
                />
              </div>
            </div>
          </div>

          {/* Preview del primer contacto */}
          {withPhone.length > 0 && template && (
            <div className="space-y-2">
              <label className="text-xs text-zinc-500 uppercase tracking-wider">Preview</label>
              <div
                className="bg-zinc-900 rounded-md px-3 py-2 text-sm text-zinc-300 italic"
                dangerouslySetInnerHTML={renderWhatsAppText(preview(withPhone[0].name ?? 'nombre'))}
              />
            </div>
          )}

          {/* Lista de seleccionados */}
          <div className="space-y-2">
            <label className="text-xs text-zinc-500 uppercase tracking-wider">
              Contactos ({withPhone.length})
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {businesses.map(b => (
                <div key={b.id} className="flex items-center justify-between text-xs py-1 border-b border-zinc-900">
                  <span className={b.phone ? 'text-zinc-300' : 'text-zinc-700 line-through'}>
                    {b.name ?? '—'}
                  </span>
                  <span className="text-zinc-600 font-mono">{b.phone ?? 'sin teléfono'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-900 space-y-2">
          {error && <p className="text-red-500 text-xs">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={creating || withPhone.length === 0 || !template.trim() || !name.trim()}
            className="w-full py-2.5 text-sm bg-white text-black rounded-md hover:bg-zinc-100 transition-colors disabled:opacity-40 font-medium"
          >
            {creating ? 'Creando campaña...' : `Crear campaña · ${withPhone.length} mensajes`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Filters = {
  search: string
  city: string
  category: string
  status: string
  website_type: string
  web_scrape_status: string
  contacted: string
  in_campaign: string
}

type UniqueValues = {
  cities: string[]
  categories: string[]
  statuses: string[]
  website_types: string[]
  web_scrape_statuses: string[]
}

type Pagination = { page: number; totalPages: number; total: number; pageSize: number }

// ─── Main component ───────────────────────────────────────────────────────────

export function BusinessesTable({
  initialData,
  filters,
  uniqueValues,
  pagination,
}: {
  initialData: Business[]
  filters: Filters
  uniqueValues: UniqueValues
  pagination: Pagination
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [data, setData] = useState<Business[]>(initialData)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'id', desc: true }])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    place_id: false,
    types: false,
    created_at: false,
    updated_at: false,
  })
  const [showColPanel, setShowColPanel] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)
  const [searchInput, setSearchInput] = useState(filters.search)

  // ── Modo campaña WA ──
  const [showNewModal, setShowNewModal] = useState(false)
  const [campaignMode, setCampaignMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [assignedBusinesses, setAssignedBusinesses] = useState<Record<number, string>>({})
  const MAX_CAMPAIGN = 100

  useEffect(() => {
    fetch('/api/whatsapp/assigned-businesses')
      .then(r => r.json())
      .then(d => setAssignedBusinesses(d.assigned ?? {}))
      .catch(() => {})
  }, [])

  const toggleCampaignMode = () => {
    setCampaignMode(v => !v)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: number) => {
    if (assignedBusinesses[id]) return
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else if (next.size < MAX_CAMPAIGN) { next.add(id) }
      return next
    })
  }

  const selectFirst100 = () => {
    const ids = data.filter(b => b.phone && !assignedBusinesses[b.id]).slice(0, MAX_CAMPAIGN).map(b => b.id)
    setSelectedIds(new Set(ids))
  }
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setData(initialData) }, [initialData])

  const navigate = useCallback((newFilters: Partial<Filters>, newPage = 1) => {
    const merged = { ...filters, ...newFilters }
    const params = new URLSearchParams()
    if (merged.search) params.set('search', merged.search)
    if (merged.city) params.set('city', merged.city)
    if (merged.category) params.set('category', merged.category)
    if (merged.status) params.set('status', merged.status)
    if (merged.website_type) params.set('website_type', merged.website_type)
    if (merged.web_scrape_status) params.set('web_scrape_status', merged.web_scrape_status)
    if (merged.contacted === '1' || merged.contacted === '0') params.set('contacted', merged.contacted)
    if (merged.in_campaign === '1') params.set('in_campaign', '1')
    if (newPage > 1) params.set('page', String(newPage))
    startTransition(() => { router.push(`/dashboard?${params.toString()}`) })
  }, [filters, router])

  const handleSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => navigate({ search: value }), 400)
  }

  const clearFilters = () => {
    setSearchInput('')
    startTransition(() => router.push('/dashboard'))
  }

  const updateData = useCallback(
    async (rowId: string, columnId: string, value: string | number) => {
      const numId = parseInt(rowId)
      const localValue =
        columnId === 'rating' || columnId === 'total_ratings' || columnId === 'contacted'
          ? value === '' ? null : Number(value)
          : value === '' ? null : value

      setData(prev => prev.map(row => (row.id === numId ? { ...row, [columnId]: localValue } : row)))

      const res = await fetch(`/api/businesses/${numId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: columnId, value }),
      })

      if (!res.ok) {
        setData(initialData)
        alert('Error al guardar el cambio. Revertido.')
      }
    },
    [initialData]
  )

  // Keep popup data in sync with local state
  useEffect(() => {
    if (selectedBusiness) {
      const updated = data.find(b => b.id === selectedBusiness.id)
      if (updated) setSelectedBusiness(updated)
    }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const tableData = useMemo(
    () => campaignMode ? data.filter(b => b.phone) : data,
    [campaignMode, data]
  )

  const table = useReactTable({
    data: tableData,
    columns,
    getRowId: row => String(row.id),
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    meta: { updateData },
  })

  const exportCSV = () => {
    const rows = table.getRowModel().rows
    const cols = table.getVisibleFlatColumns()
    const headers = cols.map(c => c.id)
    const csv = [
      headers.join(','),
      ...rows.map(row =>
        headers.map(h => `"${String(row.getValue(h) ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `businesses_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasFilters = filters.search || filters.city || filters.category || filters.status || filters.website_type || filters.web_scrape_status || filters.contacted || filters.in_campaign

  return (
    <div className={`flex flex-col h-full transition-opacity ${isPending ? 'opacity-60' : ''}`}>

      {/* ─── Filter bar ─── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-zinc-900 overflow-x-auto">
        <input
          placeholder="Buscar nombre, email, teléfono..."
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          className="bg-zinc-950 border border-zinc-800 text-sm text-white placeholder-zinc-700 px-3 py-1.5 rounded outline-none focus:border-zinc-600 transition-colors w-60 flex-shrink-0"
        />

        <div className="w-px h-4 bg-zinc-800 flex-shrink-0" />

        {([
          ['city', 'Ciudad', uniqueValues.cities],
          ['category', 'Categoría', uniqueValues.categories],
          ['status', 'Estado', uniqueValues.statuses],
          ['website_type', 'Tipo Web', uniqueValues.website_types],
          ['web_scrape_status', 'Scrape', uniqueValues.web_scrape_statuses],
        ] as [keyof Filters, string, string[]][]).map(([key, label, options]) => (
          <select
            key={key}
            value={filters[key]}
            onChange={e => navigate({ [key]: e.target.value })}
            className="bg-zinc-950 border border-zinc-800 text-zinc-400 text-xs px-2 py-1.5 rounded outline-none focus:border-zinc-600 hover:border-zinc-700 transition-colors max-w-[140px] flex-shrink-0"
          >
            <option value="">{label}</option>
            {options.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        ))}

        <div className="w-px h-4 bg-zinc-800 flex-shrink-0" />

        {/* Contacted switch */}
        <div className="flex items-center gap-1 flex-shrink-0 bg-zinc-950 border border-zinc-800 rounded overflow-hidden text-xs">
          {([['', 'Todos'], ['0', 'Sin contactar'], ['1', 'Contactados']] as [string, string][]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => navigate({ contacted: val })}
              className={`px-2.5 py-1.5 transition-colors ${
                filters.contacted === val
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => navigate({ in_campaign: filters.in_campaign === '1' ? '' : '1' })}
          className={`text-xs px-2.5 py-1.5 rounded border transition-colors flex-shrink-0 ${
            filters.in_campaign === '1'
              ? 'bg-zinc-800 text-white border-zinc-700'
              : 'text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
          }`}
        >
          En campaña
        </button>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0 whitespace-nowrap"
          >
            ✕ Limpiar
          </button>
        )}

        <div className="flex-1 min-w-0" />

        <span className="text-xs font-mono text-zinc-600 flex-shrink-0 whitespace-nowrap">
          {pagination.total.toLocaleString('es')}
        </span>

        <div className="w-px h-4 bg-zinc-800 flex-shrink-0" />

        {/* Column visibility */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowColPanel(v => !v)}
            className="text-xs text-zinc-500 border border-zinc-800 px-2.5 py-1.5 rounded hover:border-zinc-600 hover:text-zinc-300 transition-colors"
          >
            Columnas
          </button>
          {showColPanel && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColPanel(false)} />
              <div className="absolute right-0 top-full mt-1 bg-zinc-950 border border-zinc-800 rounded p-3 z-50 w-52 shadow-2xl">
                <p className="text-xs text-zinc-600 uppercase tracking-wider mb-2 font-medium">Visibles</p>
                <div className="flex flex-col gap-0.5">
                  {table.getAllColumns().filter(col => col.getCanHide()).map(col => (
                    <label key={col.id} className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer hover:text-white py-0.5">
                      <input type="checkbox" checked={col.getIsVisible()} onChange={col.getToggleVisibilityHandler()} className="accent-white" />
                      {col.id}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <button
          onClick={exportCSV}
          className="text-xs text-zinc-500 border border-zinc-800 px-2.5 py-1.5 rounded hover:border-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0"
        >
          CSV
        </button>

        <button
          onClick={() => setShowNewModal(true)}
          className="text-xs text-zinc-300 border border-zinc-700 px-2.5 py-1.5 rounded hover:border-zinc-500 hover:text-white transition-colors flex-shrink-0"
        >
          + Nuevo local
        </button>

        <button
          onClick={toggleCampaignMode}
          className={`text-xs px-2.5 py-1.5 rounded border transition-colors flex-shrink-0 ${
            campaignMode
              ? 'bg-white text-black border-white'
              : 'text-zinc-500 border-zinc-800 hover:border-zinc-600 hover:text-zinc-300'
          }`}
        >
          {campaignMode ? `WA: ${selectedIds.size}/100` : 'Campaña WA'}
        </button>
      </div>

      {/* ─── Barra campaña ─── */}
      {campaignMode && (
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-zinc-950 border-b border-zinc-800">
          <span className="text-xs text-zinc-400">
            <span className="text-white font-mono">{selectedIds.size}</span>
            <span className="text-zinc-600"> / {MAX_CAMPAIGN} seleccionados</span>
          </span>
          <button
            onClick={selectFirst100}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Seleccionar 100 primeros
          </button>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Limpiar
              </button>
              <div className="flex-1" />
              <button
                onClick={() => setShowCampaignModal(true)}
                className="text-xs bg-white text-black px-3 py-1.5 rounded hover:bg-zinc-100 transition-colors font-medium"
              >
                Vista previa →
              </button>
            </>
          )}
        </div>
      )}

      {/* ─── Table ─── */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="bg-zinc-950 border-b border-zinc-900">
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.getSize() }}
                    className="text-left px-4 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap select-none cursor-pointer hover:text-zinc-300 transition-colors"
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc' && <span className="text-white text-[10px]">↑</span>}
                      {header.column.getIsSorted() === 'desc' && <span className="text-white text-[10px]">↓</span>}
                      {!header.column.getIsSorted() && header.column.getCanSort() && <span className="text-zinc-800 text-[10px]">↕</span>}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => {
              const isSelected = selectedIds.has(row.original.id)
              const assignedCampaign = assignedBusinesses[row.original.id]
              const isAssigned = Boolean(assignedCampaign)
              return (
                <tr
                  key={row.id}
                  onClick={() => campaignMode ? toggleSelect(row.original.id) : setSelectedBusiness(row.original)}
                  className={`border-b border-zinc-950 transition-colors cursor-pointer ${
                    campaignMode && isSelected ? 'bg-zinc-900' :
                    campaignMode && isAssigned ? 'opacity-40 cursor-not-allowed' :
                    'hover:bg-zinc-950/70'
                  }`}
                >
                  {campaignMode && (
                    <td className="px-4 py-2 w-10" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(row.original.id)}
                        className="accent-white cursor-pointer"
                        disabled={isAssigned || (!isSelected && selectedIds.size >= MAX_CAMPAIGN)}
                      />
                    </td>
                  )}
                  {row.getVisibleCells().map((cell, i) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-4 py-2 text-sm"
                      onClick={e => {
                        if (!campaignMode && cell.column.id !== 'id' && cell.column.id !== 'contacted') {
                          e.stopPropagation()
                        }
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="min-w-0">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                        {isAssigned && cell.column.id === 'name' && (
                          <span className="flex-shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-emerald-950 text-emerald-400 border border-emerald-900 whitespace-nowrap">
                            WA · {assignedCampaign}
                          </span>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>

        {table.getRowModel().rows.length === 0 && (
          <div className="flex items-center justify-center py-20 text-zinc-600 text-sm">
            Sin resultados para los filtros aplicados
          </div>
        )}
      </div>

      {/* ─── Footer ─── */}
      <div className="flex-shrink-0 border-t border-zinc-900 px-4 py-1.5 flex items-center justify-between">
        <span className="text-xs text-zinc-700">
          Click en fila para ver detalles · Doble click en celda para editar
        </span>
        <div className="flex items-center gap-3">
          <button
            disabled={pagination.page <= 1}
            onClick={() => navigate({}, pagination.page - 1)}
            className="text-xs text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            ← Anterior
          </button>
          <span className="text-xs text-zinc-600 font-mono">
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => navigate({}, pagination.page + 1)}
            className="text-xs text-zinc-500 hover:text-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente →
          </button>
        </div>
      </div>

      {/* ─── Row Popup ─── */}
      {selectedBusiness && !campaignMode && (
        <RowPopup
          business={selectedBusiness}
          onClose={() => setSelectedBusiness(null)}
          onToggleContacted={async () => {
            const newVal = selectedBusiness.contacted ? 0 : 1
            await updateData(String(selectedBusiness.id), 'contacted', newVal)
          }}
        />
      )}

      {/* ─── New Business Modal ─── */}
      {showNewModal && (
        <NewBusinessModal
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false)
            router.refresh()
          }}
        />
      )}

      {/* ─── Campaign Modal ─── */}
      {showCampaignModal && (
        <CampaignModal
          businesses={data.filter(b => selectedIds.has(b.id))}
          onClose={() => setShowCampaignModal(false)}
          onCreated={() => {
            setShowCampaignModal(false)
            setCampaignMode(false)
            setSelectedIds(new Set())
          }}
        />
      )}
    </div>
  )
}
