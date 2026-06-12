'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff, X, Save, Link2, List, ListOrdered } from 'lucide-react'
import type { TextWidget } from '@/types'

type Position = 'announcement' | 'home-section'

const POSITION_LABELS: Record<Position, string> = {
  'announcement': 'Announcement Banner (top of home page)',
  'home-section': 'Home Section (between learning paths & courses)',
}

interface FormState {
  title: string
  content: string
  position: Position
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  title: '',
  content: '',
  position: 'announcement',
  is_active: true,
}

function ToolBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className="px-2 py-1 rounded text-brand-gold-muted hover:text-brand-gold hover:bg-brand-border/50 transition-colors text-xs min-w-[26px] flex items-center justify-center"
    >
      {children}
    </button>
  )
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function hasText(html: string) {
  return html.replace(/<[^>]*>/g, '').trim().length > 0
}

export default function WidgetsPage() {
  const [widgets, setWidgets]   = useState<TextWidget[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [saving, setSaving]     = useState(false)

  const [showForm, setShowForm]   = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm]           = useState<FormState>(EMPTY_FORM)

  const editorRef = useRef<HTMLDivElement>(null)

  const loadWidgets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/widgets')
      if (!res.ok) throw new Error('Failed to load widgets')
      const data = await res.json()
      setWidgets(data.widgets)
    } catch {
      setError('Could not load widgets. Make sure the text_widgets table exists in Supabase.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadWidgets() }, [loadWidgets])

  // Populate editor when form opens
  useEffect(() => {
    if (showForm && editorRef.current) {
      editorRef.current.innerHTML = form.content
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm])

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(w: TextWidget) {
    setEditingId(w.id)
    setForm({ title: w.title, content: w.content, position: w.position, is_active: w.is_active })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    if (editorRef.current) editorRef.current.innerHTML = ''
  }

  function syncContent() {
    if (editorRef.current) {
      setForm(f => ({ ...f, content: editorRef.current!.innerHTML }))
    }
  }

  function execCmd(cmd: string, value?: string) {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
    syncContent()
  }

  function handleLink() {
    const sel = window.getSelection()
    const selectedText = sel && sel.toString().trim()
    const url = window.prompt('Enter link URL (e.g. https://example.com)')
    if (!url) return
    if (selectedText) {
      execCmd('createLink', url)
    } else {
      const text = window.prompt('Link text to display') || url
      document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${text}</a>`)
      syncContent()
    }
  }

  async function handleSave() {
    const html = editorRef.current?.innerHTML ?? ''
    if (!form.title.trim() || !hasText(html)) return
    setSaving(true)
    try {
      const url    = editingId ? `/api/admin/widgets/${editingId}` : '/api/admin/widgets'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, content: html }),
      })
      if (!res.ok) throw new Error('Save failed')
      cancelForm()
      await loadWidgets()
    } catch {
      setError('Failed to save widget.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(w: TextWidget) {
    try {
      await fetch(`/api/admin/widgets/${w.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !w.is_active }),
      })
      setWidgets(prev => prev.map(x => x.id === w.id ? { ...x, is_active: !x.is_active } : x))
    } catch {
      setError('Failed to toggle widget.')
    }
  }

  async function handleDelete(w: TextWidget) {
    if (!confirm(`Delete widget "${w.title}"?`)) return
    try {
      const res = await fetch(`/api/admin/widgets/${w.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setWidgets(prev => prev.filter(x => x.id !== w.id))
    } catch {
      setError('Failed to delete widget.')
    }
  }

  const isSaveDisabled = saving || !form.title.trim() || !hasText(form.content)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-brand-gold font-bold text-xl">Content Widgets</h1>
          <p className="text-brand-gold-muted text-sm mt-1">
            Manage rich-text widgets shown on the home page. Changes are live immediately.
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Widget
        </button>
      </div>

      {error && (
        <div className="p-4 bg-brand-error/10 border border-brand-error/30 rounded-xl text-brand-error text-sm">
          {error}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="bg-brand-card border border-brand-gold/30 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-brand-gold font-semibold text-sm">
              {editingId ? 'Edit Widget' : 'New Widget'}
            </h2>
            <button onClick={cancelForm} className="text-brand-gold-muted hover:text-brand-body transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-brand-gold-muted text-xs font-medium mb-1">
                Admin Label <span className="text-brand-error">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Summer Sale Announcement"
                className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm focus:outline-none focus:border-brand-gold"
              />
            </div>

            <div>
              <label className="block text-brand-gold-muted text-xs font-medium mb-1">Position</label>
              <select
                value={form.position}
                onChange={e => setForm(f => ({ ...f, position: e.target.value as Position }))}
                className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm focus:outline-none focus:border-brand-gold"
              >
                {(Object.entries(POSITION_LABELS) as [Position, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rich text editor */}
          <div>
            <label className="block text-brand-gold-muted text-xs font-medium mb-1">
              Widget Content <span className="text-brand-error">*</span>
            </label>
            <div className="border border-brand-border rounded-lg overflow-hidden focus-within:border-brand-gold transition-colors">
              {/* Toolbar */}
              <div className="flex items-center gap-0.5 px-2 py-1.5 bg-brand-bg border-b border-brand-border flex-wrap">
                <ToolBtn onClick={() => execCmd('bold')} title="Bold (Ctrl+B)">
                  <strong>B</strong>
                </ToolBtn>
                <ToolBtn onClick={() => execCmd('italic')} title="Italic (Ctrl+I)">
                  <em>I</em>
                </ToolBtn>
                <ToolBtn onClick={() => execCmd('underline')} title="Underline (Ctrl+U)">
                  <span className="underline">U</span>
                </ToolBtn>

                <div className="w-px h-4 bg-brand-border mx-1 flex-shrink-0" />

                <ToolBtn onClick={() => execCmd('formatBlock', 'h1')} title="Heading 1">
                  <span className="font-bold">H1</span>
                </ToolBtn>
                <ToolBtn onClick={() => execCmd('formatBlock', 'h2')} title="Heading 2">
                  <span className="font-bold">H2</span>
                </ToolBtn>
                <ToolBtn onClick={() => execCmd('formatBlock', 'h3')} title="Heading 3">
                  <span className="font-bold">H3</span>
                </ToolBtn>
                <ToolBtn onClick={() => execCmd('formatBlock', 'p')} title="Normal paragraph">
                  P
                </ToolBtn>

                <div className="w-px h-4 bg-brand-border mx-1 flex-shrink-0" />

                <ToolBtn onClick={() => execCmd('insertUnorderedList')} title="Bullet list">
                  <List className="w-3.5 h-3.5" />
                </ToolBtn>
                <ToolBtn onClick={() => execCmd('insertOrderedList')} title="Numbered list">
                  <ListOrdered className="w-3.5 h-3.5" />
                </ToolBtn>

                <div className="w-px h-4 bg-brand-border mx-1 flex-shrink-0" />

                <ToolBtn onClick={handleLink} title="Insert link">
                  <Link2 className="w-3.5 h-3.5" />
                </ToolBtn>
                <ToolBtn onClick={() => execCmd('unlink')} title="Remove link">
                  <span className="line-through opacity-70">url</span>
                </ToolBtn>
              </div>

              {/* Editable content area */}
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncContent}
                className={[
                  'min-h-[180px] max-h-[400px] overflow-y-auto p-3 text-brand-body text-sm focus:outline-none',
                  '[&_h1]:text-brand-gold [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-2 [&_h1]:mt-1',
                  '[&_h2]:text-brand-gold [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-1.5 [&_h2]:mt-1',
                  '[&_h3]:text-brand-gold [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1',
                  '[&_p]:mb-2 [&_p]:leading-relaxed',
                  '[&_a]:text-brand-gold [&_a]:underline [&_a]:cursor-pointer',
                  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2',
                  '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2',
                  '[&_li]:mb-0.5',
                  '[&_strong]:font-bold [&_em]:italic [&_u]:underline',
                ].join(' ')}
              />
            </div>
            <p className="text-brand-gold-muted text-xs mt-1">
              Supports bold, italic, underline, headings, lists, and links.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                className="w-4 h-4 accent-brand-gold"
              />
              <span className="text-brand-body text-sm">Active (visible on home page)</span>
            </label>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={isSaveDisabled}
              className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : 'Save Widget'}
            </button>
            <button
              onClick={cancelForm}
              className="px-4 py-2 border border-brand-border text-brand-gold-muted text-sm rounded-lg hover:border-brand-gold hover:text-brand-gold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Widget list */}
      {loading ? (
        <div className="text-brand-gold-muted text-sm py-8 text-center">Loading widgets…</div>
      ) : widgets.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-xl p-8 text-center">
          <p className="text-brand-gold-muted text-sm">No widgets yet.</p>
          <p className="text-brand-gold-muted text-xs mt-1">
            Click &ldquo;Add Widget&rdquo; to create your first text announcement.
          </p>
        </div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-brand-border bg-brand-bg">
            <span className="text-brand-gold-muted text-xs uppercase font-medium">
              {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-brand-border">
            {widgets.map(w => (
              <div key={w.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-brand-body font-medium text-sm">{w.title}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      w.is_active
                        ? 'bg-brand-success/20 text-brand-success'
                        : 'bg-brand-border text-brand-gold-muted'
                    }`}>
                      {w.is_active ? 'Active' : 'Hidden'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-brand-gold/10 text-brand-gold">
                      {POSITION_LABELS[w.position as Position]?.split(' (')[0] ?? w.position}
                    </span>
                  </div>
                  {/* Plain-text preview strips HTML tags */}
                  <p className="text-brand-gold-muted text-xs mt-1.5 leading-relaxed line-clamp-2">
                    {stripHtml(w.content)}
                  </p>
                  <p className="text-brand-gold-muted text-[11px] mt-1">
                    Created {new Date(w.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(w)}
                    title={w.is_active ? 'Hide widget' : 'Show widget'}
                    className="p-2 text-brand-gold-muted hover:text-brand-gold rounded-lg hover:bg-brand-border/40 transition-colors"
                  >
                    {w.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => openEdit(w)}
                    title="Edit widget"
                    className="p-2 text-brand-gold-muted hover:text-brand-gold rounded-lg hover:bg-brand-border/40 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(w)}
                    title="Delete widget"
                    className="p-2 text-brand-gold-muted hover:text-brand-error rounded-lg hover:bg-brand-error/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
