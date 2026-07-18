'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, Upload, X } from 'lucide-react'
import type { Chapter, Course, ExamQuestion } from '@/types'

type ImportRow = {
  course_id:      number
  chapter_id?:    number
  chapter_name?:  string
  question_te:    string
  option_a_te:    string
  option_b_te:    string
  option_c_te:    string
  option_d_te:    string
  correct_option: 'a' | 'b' | 'c' | 'd'
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const cols: string[] = []
    let i = 0
    while (i < line.length) {
      if (line[i] === '"') {
        i++
        let val = ''
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2 }
          else if (line[i] === '"') { i++; break }
          else { val += line[i++] }
        }
        cols.push(val)
        if (line[i] === ',') i++
      } else {
        const end = line.indexOf(',', i)
        if (end === -1) { cols.push(line.slice(i).trim()); break }
        cols.push(line.slice(i, end).trim())
        i = end + 1
      }
    }
    rows.push(cols)
  }
  return rows
}

const BLANK_FORM = {
  chapter_id:   undefined as number | undefined,
  chapter_name: '',
  question_en: '', question_te: '',
  option_a_en: '', option_a_te: '',
  option_b_en: '', option_b_te: '',
  option_c_en: '', option_c_te: '',
  option_d_en: '', option_d_te: '',
  correct_option: 'a' as 'a' | 'b' | 'c' | 'd',
}

export default function ExamQuestionsPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingRows, setPendingRows] = useState<ImportRow[] | null>(null)
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/admin/courses')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCourses(data) })
  }, [])

  const loadQuestions = useCallback(async () => {
    if (!selectedCourseId) return
    setLoading(true)
    const url = `/api/admin/exam-questions?courseId=${selectedCourseId}`
    const res = await fetch(url)
    const data = await res.json()
    setQuestions(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [selectedCourseId])

  useEffect(() => { loadQuestions() }, [loadQuestions])

  useEffect(() => {
    if (!selectedCourseId) { setChapters([]); return }
    fetch(`/api/admin/chapters?courseId=${selectedCourseId}`)
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setChapters(data) })
      .catch(() => {})
  }, [selectedCourseId])

  function openAdd() {
    setEditId(null)
    setForm({ ...BLANK_FORM })
    setError('')
    setShowForm(true)
  }

  function openEdit(q: ExamQuestion) {
    setEditId(q.id)
    setForm({
      chapter_id:   q.chapter_id,
      chapter_name: q.chapter_name || '',
      question_en:  q.question_en,
      question_te:  q.question_te || '',
      option_a_en:  q.option_a_en,
      option_a_te:  q.option_a_te || '',
      option_b_en:  q.option_b_en,
      option_b_te:  q.option_b_te || '',
      option_c_en:  q.option_c_en,
      option_c_te:  q.option_c_te || '',
      option_d_en:  q.option_d_en,
      option_d_te:  q.option_d_te || '',
      correct_option: q.correct_option,
    })
    setError('')
    setShowForm(true)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedCourseId) return
    setImportError('')
    setPendingRows(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const allRows = parseCSV(ev.target?.result as string)
        // Skip header row if first cell looks like a label
        const dataRows = allRows[0]?.[0]?.toLowerCase().includes('chapter') ? allRows.slice(1) : allRows
        const rows: ImportRow[] = []
        const errs: string[] = []
        for (let i = 0; i < dataRows.length; i++) {
          const cols = dataRows[i]
          const [chapterNum, question, optA, optB, optC, optD, answer] = cols
          const correct = answer?.trim().toLowerCase() as 'a' | 'b' | 'c' | 'd'
          if (!['a', 'b', 'c', 'd'].includes(correct)) {
            errs.push(`Row ${i + 2}: invalid correct answer "${answer?.trim()}"`)
            continue
          }
          if (!question?.trim()) { errs.push(`Row ${i + 2}: question is empty`); continue }
          if (!optA?.trim() || !optB?.trim() || !optC?.trim() || !optD?.trim()) {
            errs.push(`Row ${i + 2}: all four options are required`); continue
          }
          // Match chapter by order_index
          const chIdx = Number(chapterNum?.trim())
          const ch = chapters.find(c => c.order_index === chIdx)
          rows.push({
            course_id:      selectedCourseId,
            chapter_id:     ch?.id,
            chapter_name:   ch ? (ch.title_en || ch.title_te || '') : undefined,
            question_te:    question.trim(),
            option_a_te:    optA.trim(),
            option_b_te:    optB.trim(),
            option_c_te:    optC.trim(),
            option_d_te:    optD.trim(),
            correct_option: correct,
          })
        }
        if (errs.length) { setImportError(errs.slice(0, 3).join(' · ') + (errs.length > 3 ? ` (+${errs.length - 3} more)` : '')); return }
        if (!rows.length) { setImportError('No valid rows found in CSV'); return }
        setPendingRows(rows)
      } catch {
        setImportError('Could not parse CSV file')
      }
    }
    reader.readAsText(file)
  }

  async function handleImport() {
    if (!pendingRows || !selectedCourseId) return
    setImporting(true)
    setImportError('')
    const res = await fetch('/api/admin/exam-questions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: pendingRows }),
    })
    if (!res.ok) {
      const d = await res.json()
      setImportError(d.error || 'Import failed')
    } else {
      setPendingRows(null)
      loadQuestions()
    }
    setImporting(false)
  }

  function formIsValid() {
    const hasQuestion = form.question_en.trim() || form.question_te.trim()
    const hasA = form.option_a_en.trim() || form.option_a_te.trim()
    const hasB = form.option_b_en.trim() || form.option_b_te.trim()
    const hasC = form.option_c_en.trim() || form.option_c_te.trim()
    const hasD = form.option_d_en.trim() || form.option_d_te.trim()
    return !!(hasQuestion && hasA && hasB && hasC && hasD)
  }

  async function handleSave() {
    if (!selectedCourseId) return
    setSaving(true)
    setError('')

    const payload = {
      course_id:    selectedCourseId,
      chapter_id:   form.chapter_id,
      chapter_name: form.chapter_name.trim() || undefined,
      question_en:  form.question_en,
      question_te:  form.question_te,
      option_a_en:  form.option_a_en,
      option_a_te:  form.option_a_te,
      option_b_en:  form.option_b_en,
      option_b_te:  form.option_b_te,
      option_c_en:  form.option_c_en,
      option_c_te:  form.option_c_te,
      option_d_en:  form.option_d_en,
      option_d_te:  form.option_d_te,
      correct_option: form.correct_option,
    }

    const url = editId ? `/api/admin/exam-questions/${editId}` : '/api/admin/exam-questions'
    const method = editId ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const d = await res.json()
      setError(d.error || 'Failed to save question')
    } else {
      setShowForm(false)
      loadQuestions()
    }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this question? This cannot be undone.')) return
    const res = await fetch(`/api/admin/exam-questions/${id}`, { method: 'DELETE' })
    if (res.ok) loadQuestions()
  }

  // Unique chapter names in this course's questions (for info display)
  const chapterNames = [...new Set(questions.map(q => q.chapter_name).filter(Boolean))] as string[]

  const selectedCourse = courses.find(c => c.id === selectedCourseId)
  const inputCls = 'w-full bg-brand-bg border border-brand-border text-brand-body rounded-lg px-3 py-2 text-sm'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-brand-gold font-bold text-xl">Exam Question Bank</h1>
          <p className="text-brand-gold-muted text-sm mt-1">5 random questions per chapter name are shown in the exam</p>
        </div>
        {selectedCourseId && (
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border border-brand-border text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold rounded-lg transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Import CSV
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </button>
          </div>
        )}
      </div>

      {/* Course selector */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-4">
        <label className="block text-brand-gold-muted text-xs mb-2">Select Course</label>
        <div className="relative max-w-xs">
          <select
            value={selectedCourseId ?? ''}
            onChange={e => setSelectedCourseId(e.target.value ? Number(e.target.value) : null)}
            className="w-full bg-brand-bg border border-brand-border text-brand-body rounded-lg px-3 py-2 text-sm appearance-none pr-8"
          >
            <option value="">— Choose a course —</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.title_en || c.title_te}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold-muted pointer-events-none" />
        </div>
        {chapterNames.length > 0 && (
          <p className="text-brand-gold-muted text-xs mt-2">
            Chapters in bank: {chapterNames.join(' · ')}
          </p>
        )}
      </div>

      {/* Import CSV preview / error */}
      {(pendingRows || importError) && selectedCourseId && (
        <div className="bg-brand-card border border-brand-gold/30 rounded-xl p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {pendingRows && (
                <p className="text-brand-gold text-sm font-semibold">
                  {pendingRows.length} question{pendingRows.length !== 1 ? 's' : ''} ready to import
                </p>
              )}
              {importError && <p className="text-brand-error text-xs mt-1">{importError}</p>}
              {pendingRows && (
                <p className="text-brand-gold-muted text-xs mt-1">
                  Chapters: {[...new Set(pendingRows.map(r => r.chapter_name).filter(Boolean))].join(' · ') || 'Uncategorized'}
                </p>
              )}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setPendingRows(null); setImportError('') }}
                className="p-1.5 text-brand-gold-muted hover:text-brand-error transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              {pendingRows && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="px-4 py-1.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm disabled:opacity-50"
                >
                  {importing ? 'Importing…' : 'Confirm Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedCourseId && (
        <>
          {/* Question list */}
          {loading ? (
            <div className="text-center py-12 text-brand-gold text-2xl animate-pulse">ॐ</div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 text-brand-gold-muted text-sm">
              No questions yet. Click &quot;Add Question&quot; to start building the bank.
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={q.id} className="bg-brand-card border border-brand-border rounded-xl p-4 flex gap-4 items-start">
                  <span className="text-brand-gold-muted text-xs w-6 shrink-0 mt-0.5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {q.chapter_name && (
                        <span className="text-brand-gold-muted text-xs bg-brand-border/40 px-1.5 py-0.5 rounded">
                          {q.chapter_name}
                        </span>
                      )}
                      <span className="text-brand-gold-muted text-xs">#{q.id}</span>
                    </div>
                    <p className="text-brand-body text-sm mb-2 line-clamp-2">{q.question_en || q.question_te}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {(['a', 'b', 'c', 'd'] as const).map(opt => {
                        const text = (q[`option_${opt}_en` as keyof ExamQuestion] as string) || (q[`option_${opt}_te` as keyof ExamQuestion] as string) || ''
                        return (
                          <span key={opt} className={`text-xs ${q.correct_option === opt ? 'text-brand-success font-semibold' : 'text-brand-gold-muted'}`}>
                            {opt.toUpperCase()}. {text}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEdit(q)} className="p-1.5 text-brand-gold-muted hover:text-brand-gold transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(q.id)} className="p-1.5 text-brand-gold-muted hover:text-brand-error transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-2xl my-8">
            <h2 className="text-brand-gold font-bold text-lg mb-4">
              {editId ? 'Edit Question' : 'Add Question'} — {selectedCourse?.title_en || selectedCourse?.title_te}
            </h2>

            {error && <p className="text-brand-error text-sm mb-3">{error}</p>}

            {/* Chapter */}
            <div className="mb-4">
              <label className="block text-brand-gold-muted text-xs mb-1.5">Chapter</label>
              <div className="relative max-w-xs">
                <select
                  value={form.chapter_id ?? ''}
                  onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : undefined
                    const ch = chapters.find(c => c.id === id)
                    const name = ch ? (ch.title_en || ch.title_te || '') : ''
                    setForm(f => ({ ...f, chapter_id: id, chapter_name: name }))
                  }}
                  className={`${inputCls} appearance-none pr-8`}
                >
                  <option value="">— No chapter —</option>
                  {chapters.map(c => (
                    <option key={c.id} value={c.id}>{c.order_index}. {c.title_en || c.title_te}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold-muted pointer-events-none" />
              </div>
              {chapters.length === 0 && (
                <p className="text-brand-gold-muted text-[10px] mt-1">Add chapters to this course first</p>
              )}
            </div>

            {/* Question */}
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-brand-gold-muted text-xs mb-1">Question (English)</label>
                <textarea
                  rows={3}
                  value={form.question_en}
                  onChange={e => setForm(f => ({ ...f, question_en: e.target.value }))}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <label className="block text-brand-gold-muted text-xs mb-1">Question (Telugu)</label>
                <textarea
                  rows={2}
                  value={form.question_te}
                  onChange={e => setForm(f => ({ ...f, question_te: e.target.value }))}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {(['a', 'b', 'c', 'd'] as const).map(opt => (
                <div key={opt} className={`p-3 rounded-lg border ${form.correct_option === opt ? 'border-brand-success/60 bg-brand-success/5' : 'border-brand-border'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, correct_option: opt }))}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-colors ${
                        form.correct_option === opt ? 'border-brand-success bg-brand-success text-brand-bg' : 'border-brand-border text-brand-gold-muted hover:border-brand-gold'
                      }`}
                    >
                      {opt.toUpperCase()}
                    </button>
                    <span className="text-brand-gold-muted text-xs">Option {opt.toUpperCase()} {form.correct_option === opt && '✓ Correct'}</span>
                  </div>
                  <input
                    type="text"
                    placeholder="English"
                    value={form[`option_${opt}_en` as keyof typeof form] as string}
                    onChange={e => setForm(f => ({ ...f, [`option_${opt}_en`]: e.target.value }))}
                    className="w-full bg-brand-bg border border-brand-border text-brand-body rounded px-2 py-1.5 text-xs mb-1.5"
                  />
                  <input
                    type="text"
                    placeholder="Telugu"
                    value={form[`option_${opt}_te` as keyof typeof form] as string}
                    onChange={e => setForm(f => ({ ...f, [`option_${opt}_te`]: e.target.value }))}
                    className="w-full bg-brand-bg border border-brand-border text-brand-body rounded px-2 py-1.5 text-xs"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-brand-gold-muted hover:text-brand-gold transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formIsValid()}
                className="px-5 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm disabled:opacity-50"
              >
                {saving ? 'Saving…' : editId ? 'Update' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
