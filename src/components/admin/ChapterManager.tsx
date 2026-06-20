'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, X, Check, HelpCircle, Upload, Download, FileWarning } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import QuizManager from './QuizManager'
import type { Chapter } from '@/types'
import { QUIZ_LANGUAGES, csvTemplateHeaders } from '@/lib/quiz-languages'

interface Props { courseId: number }

const emptyForm = { title_en: '', title_te: '', order_index: undefined as number | undefined }

// ── CSV helpers ────────────────────────────────────────────────────────────────

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let field = ''
      i++
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2 }
        else if (line[i] === '"') { i++; break }
        else { field += line[i++] }
      }
      result.push(field)
      if (line[i] === ',') i++
    } else {
      const end = line.indexOf(',', i)
      if (end === -1) { result.push(line.slice(i).trim()); break }
      result.push(line.slice(i, end).trim())
      i = end + 1
    }
  }
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = splitCSVLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = splitCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx]?.trim() ?? '' })
    return row
  })
}

function validateRows(rows: Record<string, string>[]): string[] {
  const pLang = QUIZ_LANGUAGES[0].code
  const errors: string[] = []
  rows.forEach((row, i) => {
    if (!row[`question_${pLang}`]) errors.push(`Row ${i + 1}: question_${pLang} required`)
    else if (!row[`option_a_${pLang}`] || !row[`option_b_${pLang}`] || !row[`option_c_${pLang}`] || !row[`option_d_${pLang}`])
      errors.push(`Row ${i + 1}: all four option_[a-d]_${pLang} required`)
    else if (!['a', 'b', 'c', 'd'].includes(row['correct_option']?.toLowerCase()))
      errors.push(`Row ${i + 1}: correct_option must be a, b, c, or d`)
  })
  return errors
}

// ── Component ──────────────────────────────────────────────────────────────────

type PanelMode = 'quiz' | 'upload'

interface UploadState {
  rows: Record<string, string>[]
  parseErrors: string[]
  fileName: string
  importing: boolean
  result: { imported: number; skipped: number; errors: string[] } | null
}

const emptyUpload: UploadState = { rows: [], parseErrors: [], fileName: '', importing: false, result: null }

export default function ChapterManager({ courseId }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Chapter>>({})
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ ...emptyForm })
  const [deleteTarget, setDeleteTarget] = useState<Chapter | null>(null)
  const [openPanel, setOpenPanel] = useState<{ id: number; mode: PanelMode } | null>(null)
  const [upload, setUpload] = useState<UploadState>({ ...emptyUpload })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const inputCls = 'w-full px-2.5 py-1.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-xs placeholder:text-brand-gold-muted/40 focus:outline-none focus:border-brand-gold transition-colors'

  useEffect(() => {
    fetchChapters()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  async function fetchChapters() {
    setLoading(true)
    const res = await fetch(`/api/admin/chapters?courseId=${courseId}`)
    const data = await res.json()
    setChapters(data)
    setLoading(false)
  }

  function togglePanel(id: number, mode: PanelMode) {
    if (openPanel?.id === id && openPanel.mode === mode) {
      setOpenPanel(null)
    } else {
      setOpenPanel({ id, mode })
      if (mode === 'upload') setUpload({ ...emptyUpload })
    }
  }

  async function handleAdd() {
    if (!addForm.title_en.trim()) { setError('English title is required.'); return }
    setError('')
    setSaving(true)
    const res = await fetch(`/api/admin/chapters?courseId=${courseId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, order_index: addForm.order_index ?? chapters.length + 1 }),
    })
    setSaving(false)
    if (res.ok) { setShowAdd(false); setAddForm({ ...emptyForm }); fetchChapters() }
    else { const d = await res.json(); setError(d.error || 'Failed to add chapter') }
  }

  async function handleEditSave(chapter: Chapter) {
    if (!editForm.title_en?.trim()) { setError('English title is required.'); return }
    setError('')
    setSaving(true)
    const res = await fetch(`/api/admin/chapters/${chapter.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title_en: editForm.title_en, title_te: editForm.title_te, order_index: editForm.order_index }),
    })
    setSaving(false)
    if (res.ok) { setEditingId(null); fetchChapters() }
    else { const d = await res.json(); setError(d.error || 'Update failed') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    await fetch(`/api/admin/chapters/${deleteTarget.id}`, { method: 'DELETE' })
    setSaving(false)
    setDeleteTarget(null)
    fetchChapters()
  }

  async function handleReorder(chapter: Chapter, dir: 'up' | 'down') {
    const sorted = [...chapters].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex(c => c.id === chapter.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    await Promise.all([
      fetch(`/api/admin/chapters/${chapter.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: other.order_index }),
      }),
      fetch(`/api/admin/chapters/${other.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: chapter.order_index }),
      }),
    ])
    fetchChapters()
  }

  async function downloadTemplate(chapterId: number) {
    const res = await fetch(`/api/admin/chapters/${chapterId}/quiz/template`)
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'chapter-quiz-template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      const parseErrors = validateRows(rows)
      setUpload({ rows, parseErrors, fileName: file.name, importing: false, result: null })
    }
    reader.readAsText(file)
  }

  async function handleImport(chapterId: number) {
    if (upload.rows.length === 0) return
    setUpload(u => ({ ...u, importing: true, result: null }))
    const res = await fetch(`/api/admin/chapters/${chapterId}/quiz/import`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upload.rows),
    })
    const data = await res.json()
    setUpload(u => ({ ...u, importing: false, result: res.ok ? data : { imported: 0, skipped: 0, errors: [data.error] } }))
    if (res.ok && data.imported > 0) fetchChapters()
    // reset file input
    if (fileRef.current) fileRef.current.value = ''
  }

  const sorted = [...chapters].sort((a, b) => a.order_index - b.order_index)
  const templateCols = csvTemplateHeaders()

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
        <div>
          <h3 className="text-brand-gold font-semibold text-sm">
            Chapters &amp; Chapter Quizzes <span className="text-brand-gold-muted font-normal">({chapters.length})</span>
          </h3>
          <p className="text-brand-gold-muted text-[10px] mt-0.5">
            Supported languages: {QUIZ_LANGUAGES.map(l => `${l.labelNative} (${l.code})`).join(', ')}
          </p>
        </div>
        <button onClick={() => { setShowAdd(true); setError('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Chapter
        </button>
      </div>

      {error && (
        <div className="px-5 py-3 bg-brand-error/10 border-b border-brand-error/20 text-brand-error text-xs">{error}</div>
      )}

      {loading ? (
        <div className="px-5 py-8 text-center text-brand-gold-muted text-sm">Loading chapters…</div>
      ) : sorted.length === 0 && !showAdd ? (
        <div className="px-5 py-8 text-center text-brand-gold-muted text-sm">
          No chapters yet. Click <span className="text-brand-gold">Add Chapter</span> to create one — then add quiz questions to each chapter.
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[28px_1fr_1fr_96px] gap-2 px-4 py-2 text-brand-gold-muted text-[10px] uppercase font-medium border-b border-brand-border bg-brand-bg">
            <span>#</span><span>Title (EN)</span><span>Title (TE)</span><span className="text-right">Actions</span>
          </div>

          {sorted.map((chapter, idx) => (
            <div key={chapter.id} className="border-b border-brand-border last:border-0">
              {editingId === chapter.id ? (
                /* ── Inline edit form ── */
                <div className="p-4 bg-brand-bg/60 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Title (English) *</label>
                      <input value={editForm.title_en ?? ''} onChange={e => setEditForm(f => ({ ...f, title_en: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Title (Telugu)</label>
                      <input value={editForm.title_te ?? ''} onChange={e => setEditForm(f => ({ ...f, title_te: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditSave(chapter)} disabled={saving}
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
                <div className="grid grid-cols-[28px_1fr_1fr_96px] gap-2 px-4 py-3 items-center hover:bg-brand-bg/40 transition-colors">
                  <span className="text-brand-gold-muted text-xs font-mono">{idx + 1}</span>
                  <span className="text-brand-body text-xs font-medium">{chapter.title_en}</span>
                  <span className="text-brand-gold-muted text-xs">{chapter.title_te || '—'}</span>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => handleReorder(chapter, 'up')} disabled={idx === 0}
                      className="p-1 text-brand-gold-muted hover:text-brand-gold disabled:opacity-30 transition-colors">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleReorder(chapter, 'down')} disabled={idx === sorted.length - 1}
                      className="p-1 text-brand-gold-muted hover:text-brand-gold disabled:opacity-30 transition-colors">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditingId(chapter.id); setEditForm({ ...chapter }); setError('') }}
                      className="p-1 text-brand-gold-muted hover:text-brand-gold transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => togglePanel(chapter.id, 'upload')}
                      title="Bulk upload questions from CSV"
                      className={`p-1 transition-colors ${openPanel?.id === chapter.id && openPanel.mode === 'upload' ? 'text-brand-gold' : 'text-brand-gold-muted hover:text-brand-gold'}`}>
                      <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => togglePanel(chapter.id, 'quiz')}
                      title="Manage quiz questions manually"
                      className={`p-1 transition-colors ${openPanel?.id === chapter.id && openPanel.mode === 'quiz' ? 'text-brand-gold' : 'text-brand-gold-muted hover:text-brand-gold'}`}>
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(chapter)}
                      className="p-1 text-brand-gold-muted hover:text-brand-error transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Per-chapter quiz panel ── */}
              {openPanel?.id === chapter.id && openPanel.mode === 'quiz' && (
                <div className="border-t border-brand-gold/20 bg-brand-bg/40 px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <HelpCircle className="w-3.5 h-3.5 text-brand-gold" />
                    <span className="text-brand-gold text-xs font-semibold">
                      Quiz pool — {chapter.title_en}
                      <span className="text-brand-gold-muted font-normal ml-1">(students get 5 random)</span>
                    </span>
                    <button onClick={() => setOpenPanel(null)} className="ml-auto text-brand-gold-muted hover:text-brand-gold transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <QuizManager chapterId={chapter.id} />
                </div>
              )}

              {/* ── Per-chapter CSV upload panel ── */}
              {openPanel?.id === chapter.id && openPanel.mode === 'upload' && (
                <div className="border-t border-brand-gold/20 bg-brand-bg/40 px-4 py-4 space-y-4">
                  {/* Panel header */}
                  <div className="flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5 text-brand-gold" />
                    <span className="text-brand-gold text-xs font-semibold">Bulk upload — {chapter.title_en}</span>
                    <button onClick={() => setOpenPanel(null)} className="ml-auto text-brand-gold-muted hover:text-brand-gold transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Step 1: Download template */}
                  <div className="bg-brand-bg border border-brand-border rounded-lg p-3 space-y-2">
                    <p className="text-brand-gold text-[11px] font-semibold">Step 1 — Download the CSV template</p>
                    <p className="text-brand-gold-muted text-[10px] leading-relaxed">
                      Fill in one question per row. The <code className="text-brand-gold bg-brand-card px-1 rounded">correct_option</code> column
                      must be <strong>a</strong>, <strong>b</strong>, <strong>c</strong>, or <strong>d</strong>.
                      Telugu fields are optional — leave them blank if not translated yet.
                    </p>
                    <p className="text-brand-gold-muted text-[10px]">
                      Columns: <span className="font-mono text-brand-gold-muted/80">{templateCols.join(', ')}</span>
                    </p>
                    <button
                      onClick={() => downloadTemplate(chapter.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-gold text-brand-gold text-xs rounded-lg hover:bg-brand-gold/10 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download template
                    </button>
                  </div>

                  {/* Step 2: Upload file */}
                  <div className="bg-brand-bg border border-brand-border rounded-lg p-3 space-y-2">
                    <p className="text-brand-gold text-[11px] font-semibold">Step 2 — Upload your completed CSV</p>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileChange}
                      className="block w-full text-xs text-brand-body file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-brand-gold file:text-brand-bg file:text-xs file:font-semibold file:cursor-pointer hover:file:bg-yellow-400 cursor-pointer"
                    />
                    {upload.fileName && (
                      <p className="text-brand-gold-muted text-[10px]">
                        Parsed: <span className="text-brand-body">{upload.rows.length}</span> question{upload.rows.length !== 1 ? 's' : ''} from <em>{upload.fileName}</em>
                      </p>
                    )}
                  </div>

                  {/* Validation errors */}
                  {upload.parseErrors.length > 0 && (
                    <div className="bg-brand-error/10 border border-brand-error/30 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-brand-error text-[11px] font-semibold">
                        <FileWarning className="w-3.5 h-3.5" /> {upload.parseErrors.length} validation error{upload.parseErrors.length !== 1 ? 's' : ''}
                      </div>
                      {upload.parseErrors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-brand-error text-[10px] pl-5">{e}</p>
                      ))}
                      {upload.parseErrors.length > 5 && (
                        <p className="text-brand-error/70 text-[10px] pl-5">…and {upload.parseErrors.length - 5} more</p>
                      )}
                    </div>
                  )}

                  {/* Preview table */}
                  {upload.rows.length > 0 && upload.parseErrors.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-brand-gold-muted text-[10px] font-medium uppercase">Preview (first 3 rows)</p>
                      <div className="overflow-x-auto rounded-lg border border-brand-border">
                        <table className="w-full text-[10px]">
                          <thead className="bg-brand-bg">
                            <tr>
                              <th className="px-2 py-1.5 text-left text-brand-gold-muted font-medium">#</th>
                              <th className="px-2 py-1.5 text-left text-brand-gold-muted font-medium">Question (EN)</th>
                              <th className="px-2 py-1.5 text-left text-brand-gold-muted font-medium">Question (TE)</th>
                              <th className="px-2 py-1.5 text-center text-brand-gold-muted font-medium">Answer</th>
                            </tr>
                          </thead>
                          <tbody>
                            {upload.rows.slice(0, 3).map((row, i) => (
                              <tr key={i} className="border-t border-brand-border">
                                <td className="px-2 py-1.5 text-brand-gold-muted font-mono">{i + 1}</td>
                                <td className="px-2 py-1.5 text-brand-body max-w-[180px] truncate">{row['question_en']}</td>
                                <td className="px-2 py-1.5 text-brand-gold-muted max-w-[140px] truncate">{row['question_te'] || '—'}</td>
                                <td className="px-2 py-1.5 text-brand-gold font-semibold uppercase text-center">{row['correct_option']}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {upload.rows.length > 3 && (
                        <p className="text-brand-gold-muted text-[10px]">…and {upload.rows.length - 3} more row{upload.rows.length - 3 !== 1 ? 's' : ''}</p>
                      )}
                    </div>
                  )}

                  {/* Import button */}
                  {upload.rows.length > 0 && upload.parseErrors.length === 0 && !upload.result && (
                    <button
                      onClick={() => handleImport(chapter.id)}
                      disabled={upload.importing}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg hover:bg-yellow-400 disabled:opacity-50 transition-colors">
                      <Upload className="w-3.5 h-3.5" />
                      {upload.importing ? `Importing ${upload.rows.length} questions…` : `Import ${upload.rows.length} question${upload.rows.length !== 1 ? 's' : ''}`}
                    </button>
                  )}

                  {/* Import result */}
                  {upload.result && (
                    <div className={`rounded-lg p-3 border text-xs space-y-1 ${upload.result.imported > 0 ? 'bg-brand-success/10 border-brand-success/30 text-brand-success' : 'bg-brand-error/10 border-brand-error/30 text-brand-error'}`}>
                      {upload.result.imported > 0 && (
                        <p className="font-semibold">✓ {upload.result.imported} question{upload.result.imported !== 1 ? 's' : ''} imported successfully.</p>
                      )}
                      {upload.result.skipped > 0 && (
                        <p className="text-brand-gold-muted">{upload.result.skipped} row{upload.result.skipped !== 1 ? 's' : ''} skipped due to errors.</p>
                      )}
                      {upload.result.errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="pl-2">{e}</p>
                      ))}
                      <button
                        onClick={() => { setUpload({ ...emptyUpload }); if (fileRef.current) fileRef.current.value = '' }}
                        className="mt-2 text-[10px] underline underline-offset-2 text-brand-gold-muted hover:text-brand-gold">
                        Upload another file
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add chapter form */}
          {showAdd && (
            <div className="p-4 border-t border-brand-border bg-brand-bg/60 space-y-3">
              <h4 className="text-brand-gold text-xs font-semibold">New Chapter</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Title (English) *</label>
                  <input value={addForm.title_en} onChange={e => setAddForm(f => ({ ...f, title_en: e.target.value }))} className={inputCls} placeholder="e.g. Chapter 1: Introduction" />
                </div>
                <div>
                  <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Title (Telugu)</label>
                  <input value={addForm.title_te ?? ''} onChange={e => setAddForm(f => ({ ...f, title_te: e.target.value }))} className={inputCls} placeholder="Optional Telugu title" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg disabled:opacity-50">
                  <Plus className="w-3 h-3" /> {saving ? 'Adding…' : 'Add Chapter'}
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
          title="Delete Chapter"
          message={`Delete "${deleteTarget.title_en}"? This will also delete all quiz questions in this chapter. Lessons assigned to this chapter will be unassigned. This cannot be undone.`}
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
