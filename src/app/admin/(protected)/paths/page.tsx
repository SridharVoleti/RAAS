'use client'

import { useState, useEffect, useCallback } from 'react'
import { Compass, Plus, Pencil, Trash2, X, Save, Loader2 } from 'lucide-react'
import type { LearningPath } from '@/types'

interface FormState {
  slug: string
  name: string
  full_name_en: string
  full_name_te: string
  tagline_en: string
  tagline_te: string
  emoji: string
  is_active: boolean
  order_index: number
}

const EMPTY_FORM: FormState = {
  slug: '',
  name: '',
  full_name_en: '',
  full_name_te: '',
  tagline_en: '',
  tagline_te: '',
  emoji: '🕉️',
  is_active: true,
  order_index: 0,
}

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AdminPathsPage() {
  const [paths, setPaths] = useState<LearningPath[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/paths')
      if (!res.ok) throw new Error('Failed to load paths')
      const data = await res.json()
      setPaths(data.paths)
    } catch {
      setError('Failed to load learning paths.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function startCreate() {
    setForm({ ...EMPTY_FORM, order_index: paths.length + 1 })
    setEditingId(null)
    setShowForm(true)
  }

  function startEdit(p: LearningPath) {
    setForm({
      slug: p.slug,
      name: p.name,
      full_name_en: p.full_name_en ?? '',
      full_name_te: p.full_name_te ?? '',
      tagline_en: p.tagline_en ?? '',
      tagline_te: p.tagline_te ?? '',
      emoji: p.emoji,
      is_active: p.is_active,
      order_index: p.order_index,
    })
    setEditingId(p.id)
    setShowForm(true)
  }

  async function handleSave() {
    if (saving) return
    setSaving(true)
    setError(null)

    const body = {
      ...form,
      // schema requires description fields; mirror the taglines
      description_en: form.tagline_en,
      description_te: form.tagline_te,
    }

    const res = editingId
      ? await fetch(`/api/admin/paths/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      : await fetch('/api/admin/paths', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

    if (res.ok) {
      setShowForm(false)
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Save failed — check the fields')
    }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    setSaving(true)
    const res = await fetch(`/api/admin/paths/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await load()
    } else {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Delete failed')
    }
    setSaving(false)
    setConfirmDeleteId(null)
  }

  const formValid = form.name.trim().length > 0 && /^[a-z0-9-]{2,50}$/.test(form.slug)
  const inputCls = 'w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-body text-sm focus:border-brand-gold focus:outline-none'
  const labelCls = 'block text-brand-gold-muted text-xs mb-1'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-brand-gold font-bold text-2xl flex items-center gap-2">
            <Compass className="w-6 h-6" />
            Learning Paths
          </h1>
          <p className="text-brand-gold-muted text-sm mt-1">
            Define the paths shown under &ldquo;Choose Your Path&rdquo; on the home page.
          </p>
        </div>
        <button
          onClick={startCreate}
          className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Path
        </button>
      </div>

      {error && (
        <div className="bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-4 text-brand-error text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-brand-card border border-brand-gold/40 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-brand-gold font-semibold">{editingId ? 'Edit Path' : 'New Path'}</h2>
            <button onClick={() => setShowForm(false)} className="text-brand-gold-muted hover:text-brand-gold">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Short Name (acronym)</label>
              <input type="text" value={form.name} maxLength={50}
                onChange={e => {
                  const name = e.target.value
                  setForm(f => ({ ...f, name, slug: editingId ? f.slug : toSlug(name) }))
                }}
                className={inputCls} placeholder="RAAS" />
            </div>
            <div>
              <label className={labelCls}>Slug (URL)</label>
              <input type="text" value={form.slug} maxLength={50}
                onChange={e => set('slug', toSlug(e.target.value))}
                className={inputCls} placeholder="raas" />
            </div>
            <div>
              <label className={labelCls}>Full Name (English)</label>
              <input type="text" value={form.full_name_en} maxLength={200}
                onChange={e => set('full_name_en', e.target.value)}
                className={inputCls} placeholder="Ramanuja Adhyayana Adhayapaka Samakhya" />
            </div>
            <div>
              <label className={labelCls}>Full Name (Telugu)</label>
              <input type="text" value={form.full_name_te} maxLength={200}
                onChange={e => set('full_name_te', e.target.value)}
                className={inputCls} placeholder="రామానుజ అధ్యయన అధ్యాపక సమాఖ్య" />
            </div>
            <div>
              <label className={labelCls}>Tagline (English)</label>
              <input type="text" value={form.tagline_en} maxLength={500}
                onChange={e => set('tagline_en', e.target.value)}
                className={inputCls} placeholder="Vedic & Spiritual Learning" />
            </div>
            <div>
              <label className={labelCls}>Tagline (Telugu)</label>
              <input type="text" value={form.tagline_te} maxLength={500}
                onChange={e => set('tagline_te', e.target.value)}
                className={inputCls} placeholder="వేద & ఆధ్యాత్మిక అభ్యాసం" />
            </div>
            <div>
              <label className={labelCls}>Emoji</label>
              <input type="text" value={form.emoji} maxLength={8}
                onChange={e => set('emoji', e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Order</label>
              <input type="number" value={form.order_index} min={0}
                onChange={e => set('order_index', Math.max(0, Number(e.target.value)))}
                className={inputCls} />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-body">
              <input type="checkbox" checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
                className="accent-[#d4a017]" />
              Active (clickable on home page — unchecked shows as &ldquo;Coming Soon&rdquo;)
            </label>
            <button
              onClick={handleSave}
              disabled={!formValid || saving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-brand-gold-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : paths.length === 0 ? (
        <div className="text-center py-16 text-brand-gold-muted text-sm">
          No learning paths yet. Add one to show it on the home page.
        </div>
      ) : (
        <div className="space-y-3">
          {paths.map(p => (
            <div key={p.id} className="bg-brand-card border border-brand-border rounded-xl p-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className="text-2xl leading-none mt-0.5">{p.emoji}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-brand-gold font-bold">{p.name}</span>
                    <span className="text-brand-gold-muted text-xs">/{p.slug}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.is_active
                        ? 'bg-brand-success/15 text-brand-success'
                        : 'bg-brand-border text-brand-gold-muted'
                    }`}>
                      {p.is_active ? 'Active' : 'Coming Soon'}
                    </span>
                    <span className="text-brand-gold-muted text-xs">Order {p.order_index}</span>
                  </div>
                  {p.full_name_en && (
                    <p className="text-brand-body text-sm italic mt-0.5">{p.full_name_en}</p>
                  )}
                  {p.full_name_te && (
                    <p className="text-brand-gold-muted text-xs">{p.full_name_te}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => startEdit(p)}
                  title="Edit"
                  className="p-2 rounded-lg border border-brand-border text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                {confirmDeleteId === p.id ? (
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={saving}
                    className="px-2.5 py-2 rounded-lg bg-brand-error text-white text-xs font-semibold hover:bg-red-500 transition-colors disabled:opacity-50"
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(p.id)}
                    title="Delete"
                    className="p-2 rounded-lg border border-brand-border text-brand-gold-muted hover:text-brand-error hover:border-brand-error transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
