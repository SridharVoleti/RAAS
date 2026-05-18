'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, X, Check, Eye } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import type { Lesson } from '@/types'

function extractYouTubeId(input: string): string {
  const match = input.match(/(?:v=|\/embed\/|\.be\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : input.trim()
}

const emptyLesson = {
  section_title: '', title_en: '', title_te: '',
  youtube_video_id: '', duration: '', is_preview: false, order_index: 1,
}

interface Props { courseId: number }

export default function LessonManager({ courseId }: Props) {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Lesson>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ ...emptyLesson })
  const [deleteTarget, setDeleteTarget] = useState<Lesson | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLessons()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  async function fetchLessons() {
    setLoading(true)
    const res = await fetch(`/api/admin/courses/${courseId}/lessons`)
    const data = await res.json()
    setLessons(data)
    setLoading(false)
  }

  async function handleAdd() {
    setError('')
    if (!addForm.title_en.trim() || !addForm.youtube_video_id.trim()) {
      setError('English title and YouTube Video ID are required.')
      return
    }
    setSaving(true)
    const payload = { ...addForm, youtube_video_id: extractYouTubeId(addForm.youtube_video_id), order_index: lessons.length + 1 }
    const res = await fetch(`/api/admin/courses/${courseId}/lessons`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) { setShowAdd(false); setAddForm({ ...emptyLesson }); fetchLessons() }
    else { const d = await res.json(); setError(d.error || 'Failed to add lesson') }
  }

  async function handleEditSave(lesson: Lesson) {
    setError('')
    setSaving(true)
    const payload = { ...editForm, youtube_video_id: extractYouTubeId(String(editForm.youtube_video_id ?? '')) }
    const res = await fetch(`/api/admin/lessons/${lesson.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) { setEditingId(null); fetchLessons() }
    else { const d = await res.json(); setError(d.error || 'Update failed') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    await fetch(`/api/admin/lessons/${deleteTarget.id}`, { method: 'DELETE' })
    setSaving(false)
    setDeleteTarget(null)
    fetchLessons()
  }

  async function handleReorder(lesson: Lesson, dir: 'up' | 'down') {
    const sorted = [...lessons].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex(l => l.id === lesson.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return

    const other = sorted[swapIdx]
    await Promise.all([
      fetch(`/api/admin/lessons/${lesson.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lesson, order_index: other.order_index }),
      }),
      fetch(`/api/admin/lessons/${other.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...other, order_index: lesson.order_index }),
      }),
    ])
    fetchLessons()
  }

  const inputCls = 'w-full px-2.5 py-1.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-xs placeholder:text-brand-gold-muted/40 focus:outline-none focus:border-brand-gold transition-colors'
  const sorted = [...lessons].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
        <h3 className="text-brand-gold font-semibold text-sm">
          Lessons <span className="text-brand-gold-muted font-normal">({lessons.length})</span>
        </h3>
        <button onClick={() => { setShowAdd(true); setError('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Lesson
        </button>
      </div>

      {error && (
        <div className="px-5 py-3 bg-brand-error/10 border-b border-brand-error/20 text-brand-error text-xs">{error}</div>
      )}

      {loading ? (
        <div className="px-5 py-8 text-center text-brand-gold-muted text-sm">Loading lessons…</div>
      ) : sorted.length === 0 && !showAdd ? (
        <div className="px-5 py-8 text-center text-brand-gold-muted text-sm">
          No lessons yet. Click <span className="text-brand-gold">Add Lesson</span> to get started.
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="grid grid-cols-[28px_1fr_120px_80px_60px_80px] gap-2 px-4 py-2 text-brand-gold-muted text-[10px] uppercase font-medium border-b border-brand-border bg-brand-bg">
            <span>#</span><span>Title (EN) / Section</span><span>YouTube ID</span>
            <span>Duration</span><span>Preview</span><span className="text-right">Actions</span>
          </div>

          {sorted.map((lesson, idx) => (
            <div key={lesson.id} className="border-b border-brand-border last:border-0">
              {editingId === lesson.id ? (
                /* ── Inline edit form ── */
                <div className="p-4 bg-brand-bg/60 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Section Title</label>
                      <input value={editForm.section_title ?? ''} onChange={e => setEditForm(f => ({ ...f, section_title: e.target.value }))} className={inputCls} placeholder="Optional section" />
                    </div>
                    <div>
                      <label className="text-brand-gold-muted text-[10px] mb-0.5 block">YouTube URL or ID *</label>
                      <input value={editForm.youtube_video_id ?? ''} onChange={e => setEditForm(f => ({ ...f, youtube_video_id: e.target.value }))} className={inputCls} placeholder="dQw4w9WgXcQ or full URL" />
                    </div>
                    <div>
                      <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Title (English) *</label>
                      <input value={editForm.title_en ?? ''} onChange={e => setEditForm(f => ({ ...f, title_en: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Title (Telugu)</label>
                      <input value={editForm.title_te ?? ''} onChange={e => setEditForm(f => ({ ...f, title_te: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Duration</label>
                      <input value={editForm.duration ?? ''} onChange={e => setEditForm(f => ({ ...f, duration: e.target.value }))} className={inputCls} placeholder="12:30" />
                    </div>
                    <div className="flex items-end gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={editForm.is_preview ?? false} onChange={e => setEditForm(f => ({ ...f, is_preview: e.target.checked }))} className="accent-yellow-400" />
                        <span className="text-brand-body text-xs">Free Preview</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditSave(lesson)} disabled={saving}
                      className="flex items-center gap-1 px-3 py-1.5 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg disabled:opacity-50">
                      <Check className="w-3 h-3" /> Save
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-brand-border rounded-lg text-brand-body text-xs hover:border-brand-gold transition-colors">
                      <X className="w-3 h-3" /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Read-only row ── */
                <div className="grid grid-cols-[28px_1fr_120px_80px_60px_80px] gap-2 px-4 py-3 items-center hover:bg-brand-bg/40 transition-colors">
                  <span className="text-brand-gold-muted text-xs font-mono">{idx + 1}</span>
                  <div>
                    <div className="text-brand-body text-xs font-medium">{lesson.title_en}</div>
                    {lesson.section_title && <div className="text-brand-gold-muted text-[10px]">{lesson.section_title}</div>}
                  </div>
                  <span className="text-brand-gold-muted text-xs font-mono truncate">{lesson.youtube_video_id}</span>
                  <span className="text-brand-body text-xs">{lesson.duration || '—'}</span>
                  <span>{lesson.is_preview ? <Eye className="w-3.5 h-3.5 text-brand-success" /> : <span className="text-brand-border text-xs">—</span>}</span>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => handleReorder(lesson, 'up')} disabled={idx === 0}
                      className="p-1 text-brand-gold-muted hover:text-brand-gold disabled:opacity-30 transition-colors">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleReorder(lesson, 'down')} disabled={idx === sorted.length - 1}
                      className="p-1 text-brand-gold-muted hover:text-brand-gold disabled:opacity-30 transition-colors">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditingId(lesson.id); setEditForm({ ...lesson }); setError('') }}
                      className="p-1 text-brand-gold-muted hover:text-brand-gold transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(lesson)}
                      className="p-1 text-brand-gold-muted hover:text-brand-error transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add lesson form */}
          {showAdd && (
            <div className="p-4 border-t border-brand-border bg-brand-bg/60 space-y-3">
              <h4 className="text-brand-gold text-xs font-semibold">New Lesson</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Section Title</label>
                  <input value={addForm.section_title} onChange={e => setAddForm(f => ({ ...f, section_title: e.target.value }))} className={inputCls} placeholder="Optional grouping" />
                </div>
                <div>
                  <label className="text-brand-gold-muted text-[10px] mb-0.5 block">YouTube URL or ID *</label>
                  <input value={addForm.youtube_video_id} onChange={e => setAddForm(f => ({ ...f, youtube_video_id: e.target.value }))} className={inputCls} placeholder="Paste URL or just the ID" />
                </div>
                <div>
                  <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Title (English) *</label>
                  <input value={addForm.title_en} onChange={e => setAddForm(f => ({ ...f, title_en: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Title (Telugu)</label>
                  <input value={addForm.title_te} onChange={e => setAddForm(f => ({ ...f, title_te: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Duration</label>
                  <input value={addForm.duration} onChange={e => setAddForm(f => ({ ...f, duration: e.target.value }))} className={inputCls} placeholder="12:30" />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={addForm.is_preview} onChange={e => setAddForm(f => ({ ...f, is_preview: e.target.checked }))} className="accent-yellow-400" />
                    <span className="text-brand-body text-xs">Free Preview</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg disabled:opacity-50">
                  <Plus className="w-3 h-3" /> {saving ? 'Adding…' : 'Add Lesson'}
                </button>
                <button onClick={() => { setShowAdd(false); setError('') }}
                  className="flex items-center gap-1 px-3 py-1.5 border border-brand-border rounded-lg text-brand-body text-xs hover:border-brand-gold transition-colors">
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Lesson"
          message={`Delete "${deleteTarget.title_en}"? This cannot be undone and will remove any user progress for this lesson.`}
          confirmLabel="Delete"
          destructive
          loading={saving}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
