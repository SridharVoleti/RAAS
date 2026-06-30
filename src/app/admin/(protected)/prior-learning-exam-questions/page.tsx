'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, Upload, Download, ChevronDown, X, AlertCircle, CheckCircle } from 'lucide-react'
import type { PriorLearningExamQuestion } from '@/types'
import { RAMANUJA_GRANTHA_CONFIG, type PriorLearningConfig } from '@/lib/priorLearningConfigs'

// ── Config ────────────────────────────────────────────────────────────────────
const CATEGORIES: PriorLearningConfig[] = [RAMANUJA_GRANTHA_CONFIG]

type Difficulty = 1 | 2 | 3
const DIFF_LABEL: Record<Difficulty, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }
const DIFF_COLOR: Record<Difficulty, string> = { 1: 'text-brand-success', 2: 'text-brand-gold', 3: 'text-brand-error' }

const BLANK_FORM = {
  difficulty:     2 as Difficulty,
  question_en:    '', question_te:    '',
  option_a_en:    '', option_a_te:    '',
  option_b_en:    '', option_b_te:    '',
  option_c_en:    '', option_c_te:    '',
  option_d_en:    '', option_d_te:    '',
  correct_option: 'a' as 'a' | 'b' | 'c' | 'd',
}

// ── CSV template ──────────────────────────────────────────────────────────────
const CSV_HEADERS = [
  'difficulty', 'question_en', 'question_te',
  'option_a_en', 'option_a_te',
  'option_b_en', 'option_b_te',
  'option_c_en', 'option_c_te',
  'option_d_en', 'option_d_te',
  'correct_option',
]

const CSV_EXAMPLE = [
  '1', 'Who is the main deity in Sri Vaishnavism?', 'శ్రీ వైష్ణవంలో ప్రధాన దేవుడు ఎవరు?',
  'Lord Vishnu', 'శ్రీ విష్ణువు',
  'Lord Shiva', 'శ్రీ శివుడు',
  'Lord Brahma', 'శ్రీ బ్రహ్మ',
  'Lord Indra', 'శ్రీ ఇంద్రుడు',
  'a',
]

type ParsedRow = Record<string, string | number>
interface ImportError { row: number; message: string }

// ── Component ─────────────────────────────────────────────────────────────────
export default function PLExamQuestionsPage() {
  const [categoryKey, setCategoryKey] = useState(RAMANUJA_GRANTHA_CONFIG.categoryKey)
  const [filterDiff, setFilterDiff]   = useState<Difficulty | null>(null)
  const [questions, setQuestions]      = useState<PriorLearningExamQuestion[]>([])
  const [loading, setLoading]          = useState(false)

  // single-add / edit form
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<number | null>(null)
  const [form, setForm]         = useState({ ...BLANK_FORM })
  const [saving, setSaving]     = useState(false)
  const [formError, setFormError] = useState('')

  // import flow
  const [showImport, setShowImport]       = useState(false)
  const [parsedRows, setParsedRows]       = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors]     = useState<ImportError[]>([])
  const [importing, setImporting]         = useState(false)
  const [importResult, setImportResult]   = useState<{ inserted: number; skipped: number; errors: ImportError[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Data fetching ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const url = `/api/admin/prior-learning-exam-questions?category=${categoryKey}${filterDiff ? `&difficulty=${filterDiff}` : ''}`
    const res = await fetch(url)
    const data = await res.json()
    setQuestions(Array.isArray(data.questions) ? data.questions : [])
    setLoading(false)
  }, [categoryKey, filterDiff])

  useEffect(() => { load() }, [load])

  // ── Single question form ────────────────────────────────────────────────────
  function openAdd() { setEditId(null); setForm({ ...BLANK_FORM }); setFormError(''); setShowForm(true) }
  function openEdit(q: PriorLearningExamQuestion) {
    setEditId(q.id)
    setForm({
      difficulty:     q.difficulty as Difficulty,
      question_en:    q.question_en,
      question_te:    q.question_te ?? '',
      option_a_en:    q.option_a_en, option_a_te: q.option_a_te ?? '',
      option_b_en:    q.option_b_en, option_b_te: q.option_b_te ?? '',
      option_c_en:    q.option_c_en, option_c_te: q.option_c_te ?? '',
      option_d_en:    q.option_d_en, option_d_te: q.option_d_te ?? '',
      correct_option: q.correct_option,
    })
    setFormError(''); setShowForm(true)
  }

  async function handleSave() {
    setSaving(true); setFormError('')
    const payload = { category_key: categoryKey, ...form }
    const url    = editId ? `/api/admin/prior-learning-exam-questions/${editId}` : '/api/admin/prior-learning-exam-questions'
    const method = editId ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!res.ok) { const d = await res.json(); setFormError(d.error || 'Failed to save') }
    else { setShowForm(false); load() }
    setSaving(false)
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this question? This cannot be undone.')) return
    const res = await fetch(`/api/admin/prior-learning-exam-questions/${id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) load()
  }

  // ── Template download ───────────────────────────────────────────────────────
  function downloadTemplate() {
    const rows = [CSV_HEADERS.join(','), CSV_EXAMPLE.map(v => `"${v}"`).join(',')]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `pl-exam-questions-template.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ── File parsing ────────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setParsedRows([]); setParseErrors([]); setImportResult(null)

    const ext = file.name.split('.').pop()?.toLowerCase()

    if (ext === 'csv') {
      const text = await file.text()
      const rows = parseCSV(text)
      setParsedRows(rows)
    } else if (ext === 'xlsx' || ext === 'xls') {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: '' })
      setParsedRows(rows)
    } else {
      setParseErrors([{ row: 0, message: 'Unsupported file type. Please upload a .csv, .xlsx, or .xls file.' }])
    }

    // Reset input so the same file can be re-selected
    if (fileRef.current) fileRef.current.value = ''
  }

  function parseCSV(text: string): ParsedRow[] {
    const lines  = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
    if (lines.length < 2) return []

    const headers = splitCSVLine(lines[0])
    return lines.slice(1).map(line => {
      const values = splitCSVLine(line)
      return Object.fromEntries(headers.map((h, i) => [h.trim(), values[i]?.trim() ?? '']))
    })
  }

  function splitCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue }
      current += ch
    }
    result.push(current)
    return result
  }

  // ── Import to server ────────────────────────────────────────────────────────
  async function handleImport() {
    if (parsedRows.length === 0) return
    setImporting(true); setImportResult(null)

    const res = await fetch('/api/admin/prior-learning-exam-questions/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryKey, rows: parsedRows }),
    })
    const data = await res.json()

    if (!res.ok && !data.inserted) {
      setParseErrors([{ row: 0, message: data.error || 'Import failed' }])
    } else {
      setImportResult({ inserted: data.inserted ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? [] })
      setParsedRows([])
      load()
    }
    setImporting(false)
  }

  // ── Stats ───────────────────────────────────────────────────────────────────
  const countsByDiff = questions.reduce<Record<number, number>>((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] || 0) + 1
    return acc
  }, {})

  const selectedCategory = CATEGORIES.find(c => c.categoryKey === categoryKey)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-brand-gold font-bold text-xl">Prior Learning Exam Questions</h1>
          <p className="text-brand-gold-muted text-sm mt-1">Manage the question bank for prior learning assessments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-3 py-2 border border-brand-border text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold rounded-lg transition-colors text-sm"
          >
            <Download className="w-4 h-4" /> Download Template
          </button>
          <button
            onClick={() => { setShowImport(true); setImportResult(null); setParsedRows([]); setParseErrors([]) }}
            className="flex items-center gap-2 px-3 py-2 border border-brand-gold/60 text-brand-gold hover:bg-brand-gold/10 rounded-lg transition-colors text-sm"
          >
            <Upload className="w-4 h-4" /> Import CSV / Excel
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </div>
      </div>

      {/* Category selector */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-4">
        <label className="block text-brand-gold-muted text-xs mb-2">Category</label>
        <div className="relative max-w-xs">
          <select
            value={categoryKey}
            onChange={e => setCategoryKey(e.target.value)}
            className="w-full bg-brand-bg border border-brand-border text-brand-body rounded-lg px-3 py-2 text-sm appearance-none pr-8"
          >
            {CATEGORIES.map(c => (
              <option key={c.categoryKey} value={c.categoryKey}>{c.categoryName.en}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold-muted pointer-events-none" />
        </div>
      </div>

      {/* Difficulty filter + stats */}
      <div className="flex flex-wrap gap-3 items-center">
        <button
          onClick={() => setFilterDiff(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterDiff === null ? 'bg-brand-gold text-brand-bg border-brand-gold' : 'border-brand-border text-brand-gold-muted hover:text-brand-gold'}`}
        >
          All ({questions.length})
        </button>
        {([1, 2, 3] as Difficulty[]).map(d => (
          <button key={d} onClick={() => setFilterDiff(filterDiff === d ? null : d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterDiff === d ? 'bg-brand-gold text-brand-bg border-brand-gold' : 'border-brand-border text-brand-gold-muted hover:text-brand-gold'}`}
          >
            {DIFF_LABEL[d]} ({countsByDiff[d] ?? 0})
          </button>
        ))}
        <span className="ml-auto text-brand-gold-muted text-xs">Target: 50+ questions per category</span>
      </div>

      {/* Question list */}
      {loading ? (
        <div className="text-center py-12 text-brand-gold text-2xl animate-pulse">ॐ</div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-brand-gold-muted text-sm">
          No questions yet. Use &quot;Import CSV / Excel&quot; to bulk-load or &quot;Add Question&quot; for single entry.
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-brand-card border border-brand-border rounded-xl p-4 flex gap-4 items-start">
              <span className="text-brand-gold-muted text-xs w-6 shrink-0 mt-0.5">{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${DIFF_COLOR[q.difficulty as Difficulty]}`}>{DIFF_LABEL[q.difficulty as Difficulty]}</span>
                  <span className="text-brand-gold-muted text-xs">#{q.id}</span>
                </div>
                <p className="text-brand-body text-sm mb-2 line-clamp-2">{q.question_en}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {(['a', 'b', 'c', 'd'] as const).map(opt => (
                    <span key={opt} className={`text-xs ${q.correct_option === opt ? 'text-brand-success font-semibold' : 'text-brand-gold-muted'}`}>
                      {opt.toUpperCase()}. {q[`option_${opt}_en` as keyof PriorLearningExamQuestion] as string}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => openEdit(q)} className="p-1.5 text-brand-gold-muted hover:text-brand-gold transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(q.id)} className="p-1.5 text-brand-gold-muted hover:text-brand-error transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Single Add / Edit Modal ─────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-brand-gold font-bold text-lg">{editId ? 'Edit Question' : 'Add Question'} — {selectedCategory?.categoryName.en}</h2>
              <button onClick={() => setShowForm(false)} className="text-brand-gold-muted hover:text-brand-gold"><X className="w-5 h-5" /></button>
            </div>

            {formError && <p className="text-brand-error text-sm mb-3">{formError}</p>}

            <div className="mb-4">
              <label className="block text-brand-gold-muted text-xs mb-1.5">Difficulty</label>
              <div className="flex gap-2">
                {([1, 2, 3] as Difficulty[]).map(d => (
                  <button key={d} type="button" onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.difficulty === d ? 'bg-brand-gold text-brand-bg border-brand-gold' : 'border-brand-border text-brand-gold-muted hover:text-brand-gold'}`}
                  >{DIFF_LABEL[d]}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-brand-gold-muted text-xs mb-1">Question (English) *</label>
                <textarea rows={3} value={form.question_en} onChange={e => setForm(f => ({ ...f, question_en: e.target.value }))}
                  className="w-full bg-brand-bg border border-brand-border text-brand-body rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-brand-gold-muted text-xs mb-1">Question (Telugu)</label>
                <textarea rows={2} value={form.question_te} onChange={e => setForm(f => ({ ...f, question_te: e.target.value }))}
                  className="w-full bg-brand-bg border border-brand-border text-brand-body rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {(['a', 'b', 'c', 'd'] as const).map(opt => (
                <div key={opt} className={`p-3 rounded-lg border ${form.correct_option === opt ? 'border-brand-success/60 bg-brand-success/5' : 'border-brand-border'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <button type="button" onClick={() => setForm(f => ({ ...f, correct_option: opt }))}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-colors ${form.correct_option === opt ? 'border-brand-success bg-brand-success text-brand-bg' : 'border-brand-border text-brand-gold-muted hover:border-brand-gold'}`}
                    >{opt.toUpperCase()}</button>
                    <span className="text-brand-gold-muted text-xs">Option {opt.toUpperCase()} {form.correct_option === opt && '✓ Correct'}</span>
                  </div>
                  <input type="text" placeholder="English *"
                    value={form[`option_${opt}_en` as keyof typeof form] as string}
                    onChange={e => setForm(f => ({ ...f, [`option_${opt}_en`]: e.target.value }))}
                    className="w-full bg-brand-bg border border-brand-border text-brand-body rounded px-2 py-1.5 text-xs mb-1.5" />
                  <input type="text" placeholder="Telugu"
                    value={form[`option_${opt}_te` as keyof typeof form] as string}
                    onChange={e => setForm(f => ({ ...f, [`option_${opt}_te`]: e.target.value }))}
                    className="w-full bg-brand-bg border border-brand-border text-brand-body rounded px-2 py-1.5 text-xs" />
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-brand-gold-muted hover:text-brand-gold transition-colors text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.question_en.trim() || !form.option_a_en.trim() || !form.option_b_en.trim() || !form.option_c_en.trim() || !form.option_d_en.trim()}
                className="px-5 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm disabled:opacity-50">
                {saving ? 'Saving…' : editId ? 'Update' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import Modal ────────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-brand-gold font-bold text-lg">Import Questions — {selectedCategory?.categoryName.en}</h2>
              <button onClick={() => setShowImport(false)} className="text-brand-gold-muted hover:text-brand-gold"><X className="w-5 h-5" /></button>
            </div>

            {/* Column guide */}
            <div className="bg-brand-bg border border-brand-border rounded-xl p-4 mb-4 text-xs text-brand-gold-muted space-y-1.5">
              <p className="text-brand-gold font-semibold text-sm mb-2">Required columns (in any order)</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                <span><span className="text-brand-gold font-mono">difficulty</span> — 1 / Easy, 2 / Medium, 3 / Hard</span>
                <span><span className="text-brand-gold font-mono">correct_option</span> — a, b, c, or d</span>
                <span><span className="text-brand-gold font-mono">question_en</span> — English question text</span>
                <span><span className="text-brand-gold font-mono">question_te</span> — Telugu (optional)</span>
                <span><span className="text-brand-gold font-mono">option_a_en … option_d_en</span> — English options</span>
                <span><span className="text-brand-gold font-mono">option_a_te … option_d_te</span> — Telugu (optional)</span>
              </div>
            </div>

            {/* File picker */}
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-brand-border hover:border-brand-gold rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 group"
            >
              <Upload className="w-8 h-8 text-brand-gold-muted group-hover:text-brand-gold mx-auto mb-2 transition-colors" />
              <p className="text-brand-gold-muted text-sm group-hover:text-brand-gold transition-colors">
                Click to select a <span className="font-semibold">.csv</span>, <span className="font-semibold">.xlsx</span>, or <span className="font-semibold">.xls</span> file
              </p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Parse errors */}
            {parseErrors.length > 0 && (
              <div className="bg-brand-error/10 border border-brand-error/30 rounded-xl p-4 mb-4 space-y-1">
                {parseErrors.map((e, i) => (
                  <p key={i} className="text-brand-error text-xs flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {e.row > 0 ? `Row ${e.row}: ` : ''}{e.message}
                  </p>
                ))}
              </div>
            )}

            {/* Preview table */}
            {parsedRows.length > 0 && (
              <div className="mb-4">
                <p className="text-brand-gold-muted text-xs mb-2">{parsedRows.length} row(s) detected — first 5 shown below:</p>
                <div className="overflow-x-auto border border-brand-border rounded-xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-brand-border bg-brand-bg">
                        <th className="px-3 py-2 text-left text-brand-gold-muted font-medium">Diff</th>
                        <th className="px-3 py-2 text-left text-brand-gold-muted font-medium">Question (EN)</th>
                        <th className="px-3 py-2 text-left text-brand-gold-muted font-medium">A</th>
                        <th className="px-3 py-2 text-left text-brand-gold-muted font-medium">B</th>
                        <th className="px-3 py-2 text-left text-brand-gold-muted font-medium">C</th>
                        <th className="px-3 py-2 text-left text-brand-gold-muted font-medium">D</th>
                        <th className="px-3 py-2 text-left text-brand-gold-muted font-medium">Correct</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-b border-brand-border/50 last:border-0">
                          <td className="px-3 py-2 text-brand-gold-muted">{String(row.difficulty ?? row.Difficulty ?? '')}</td>
                          <td className="px-3 py-2 text-brand-body max-w-[180px] truncate">{String(row.question_en ?? row['Question (English)'] ?? row.question ?? '')}</td>
                          <td className="px-3 py-2 text-brand-gold-muted max-w-[80px] truncate">{String(row.option_a_en ?? row['Option A (English)'] ?? '')}</td>
                          <td className="px-3 py-2 text-brand-gold-muted max-w-[80px] truncate">{String(row.option_b_en ?? row['Option B (English)'] ?? '')}</td>
                          <td className="px-3 py-2 text-brand-gold-muted max-w-[80px] truncate">{String(row.option_c_en ?? row['Option C (English)'] ?? '')}</td>
                          <td className="px-3 py-2 text-brand-gold-muted max-w-[80px] truncate">{String(row.option_d_en ?? row['Option D (English)'] ?? '')}</td>
                          <td className="px-3 py-2 text-brand-gold font-semibold uppercase">{String(row.correct_option ?? row['Correct Option'] ?? row.correct ?? '')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 5 && (
                    <p className="text-center text-brand-gold-muted text-xs py-2">…and {parsedRows.length - 5} more row(s)</p>
                  )}
                </div>
              </div>
            )}

            {/* Import result */}
            {importResult && (
              <div className={`rounded-xl p-4 mb-4 space-y-1 ${importResult.inserted > 0 ? 'bg-brand-success/10 border border-brand-success/30' : 'bg-brand-error/10 border border-brand-error/30'}`}>
                {importResult.inserted > 0 && (
                  <p className="text-brand-success text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    {importResult.inserted} question(s) imported successfully.
                    {importResult.skipped > 0 && ` ${importResult.skipped} row(s) skipped.`}
                  </p>
                )}
                {importResult.errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-brand-error text-xs flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Row {e.row}: {e.message}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowImport(false)} className="px-4 py-2 text-brand-gold-muted hover:text-brand-gold transition-colors text-sm">Close</button>
              {parsedRows.length > 0 && (
                <button onClick={handleImport} disabled={importing}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm disabled:opacity-50">
                  <Upload className="w-4 h-4" />
                  {importing ? 'Importing…' : `Import ${parsedRows.length} Question${parsedRows.length !== 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
