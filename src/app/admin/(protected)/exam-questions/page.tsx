'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, ChevronDown } from 'lucide-react'
import type { Course, ExamQuestion } from '@/types'

type Difficulty = 1 | 2 | 3
const DIFF_LABEL: Record<Difficulty, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }
const DIFF_COLOR: Record<Difficulty, string> = {
  1: 'text-brand-success',
  2: 'text-brand-gold',
  3: 'text-brand-error',
}

const BLANK_FORM = {
  difficulty: 2 as Difficulty,
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
  const [filterDiff, setFilterDiff] = useState<number | null>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Load courses
  useEffect(() => {
    fetch('/api/admin/courses')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setCourses(data)
      })
  }, [])

  const loadQuestions = useCallback(async () => {
    if (!selectedCourseId) return
    setLoading(true)
    const url = `/api/admin/exam-questions?courseId=${selectedCourseId}${filterDiff ? `&difficulty=${filterDiff}` : ''}`
    const res = await fetch(url)
    const data = await res.json()
    setQuestions(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [selectedCourseId, filterDiff])

  useEffect(() => { loadQuestions() }, [loadQuestions])

  function openAdd() {
    setEditId(null)
    setForm({ ...BLANK_FORM })
    setError('')
    setShowForm(true)
  }

  function openEdit(q: ExamQuestion) {
    setEditId(q.id)
    setForm({
      difficulty:     q.difficulty as Difficulty,
      question_en:    q.question_en,
      question_te:    q.question_te || '',
      option_a_en:    q.option_a_en,
      option_a_te:    q.option_a_te || '',
      option_b_en:    q.option_b_en,
      option_b_te:    q.option_b_te || '',
      option_c_en:    q.option_c_en,
      option_c_te:    q.option_c_te || '',
      option_d_en:    q.option_d_en,
      option_d_te:    q.option_d_te || '',
      correct_option: q.correct_option,
    })
    setError('')
    setShowForm(true)
  }

  async function handleSave() {
    if (!selectedCourseId) return
    setSaving(true)
    setError('')

    const payload = {
      course_id: selectedCourseId,
      ...form,
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

  const countsByDiff = questions.reduce<Record<number, number>>((acc, q) => {
    acc[q.difficulty] = (acc[q.difficulty] || 0) + 1
    return acc
  }, {})

  const selectedCourse = courses.find(c => c.id === selectedCourseId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-brand-gold font-bold text-xl">Exam Question Bank</h1>
          <p className="text-brand-gold-muted text-sm mt-1">Manage the adaptive exam question pool (target: 200–300 per course)</p>
        </div>
        {selectedCourseId && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
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
            {courses.filter(c => c.has_exam).map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.title_en}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gold-muted pointer-events-none" />
        </div>
        {courses.filter(c => !c.has_exam).length > 0 && (
          <p className="text-brand-gold-muted text-xs mt-2">
            {courses.filter(c => !c.has_exam).length} course(s) have exam disabled. Enable via Course settings.
          </p>
        )}
      </div>

      {selectedCourseId && (
        <>
          {/* Stats + filter */}
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => setFilterDiff(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filterDiff === null ? 'bg-brand-gold text-brand-bg border-brand-gold' : 'border-brand-border text-brand-gold-muted hover:text-brand-gold'
              }`}
            >
              All ({questions.length})
            </button>
            {([1, 2, 3] as Difficulty[]).map(d => (
              <button
                key={d}
                onClick={() => setFilterDiff(filterDiff === d ? null : d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  filterDiff === d ? 'bg-brand-gold text-brand-bg border-brand-gold' : 'border-brand-border text-brand-gold-muted hover:text-brand-gold'
                }`}
              >
                {DIFF_LABEL[d]} ({countsByDiff[d] ?? 0})
              </button>
            ))}
            <span className="ml-auto text-brand-gold-muted text-xs">
              Target: 200–300 questions
            </span>
          </div>

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
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${DIFF_COLOR[q.difficulty as Difficulty]}`}>
                        {DIFF_LABEL[q.difficulty as Difficulty]}
                      </span>
                      <span className="text-brand-gold-muted text-xs">#{q.id}</span>
                    </div>
                    <p className="text-brand-body text-sm mb-2 line-clamp-2">{q.question_en}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {(['a', 'b', 'c', 'd'] as const).map(opt => (
                        <span key={opt} className={`text-xs ${q.correct_option === opt ? 'text-brand-success font-semibold' : 'text-brand-gold-muted'}`}>
                          {opt.toUpperCase()}. {q[`option_${opt}_en` as keyof ExamQuestion] as string}
                        </span>
                      ))}
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
              {editId ? 'Edit Question' : 'Add Question'} — {selectedCourse?.title_en}
            </h2>

            {error && <p className="text-brand-error text-sm mb-3">{error}</p>}

            {/* Difficulty */}
            <div className="mb-4">
              <label className="block text-brand-gold-muted text-xs mb-1.5">Difficulty</label>
              <div className="flex gap-2">
                {([1, 2, 3] as Difficulty[]).map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, difficulty: d }))}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      form.difficulty === d ? 'bg-brand-gold text-brand-bg border-brand-gold' : 'border-brand-border text-brand-gold-muted hover:text-brand-gold'
                    }`}
                  >
                    {DIFF_LABEL[d]}
                  </button>
                ))}
              </div>
            </div>

            {/* Question */}
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-brand-gold-muted text-xs mb-1">Question (English) *</label>
                <textarea
                  rows={3}
                  value={form.question_en}
                  onChange={e => setForm(f => ({ ...f, question_en: e.target.value }))}
                  className="w-full bg-brand-bg border border-brand-border text-brand-body rounded-lg px-3 py-2 text-sm resize-none"
                />
              </div>
              <div>
                <label className="block text-brand-gold-muted text-xs mb-1">Question (Telugu)</label>
                <textarea
                  rows={2}
                  value={form.question_te}
                  onChange={e => setForm(f => ({ ...f, question_te: e.target.value }))}
                  className="w-full bg-brand-bg border border-brand-border text-brand-body rounded-lg px-3 py-2 text-sm resize-none"
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
                    placeholder={`English *`}
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
                disabled={saving || !form.question_en.trim() || !form.option_a_en.trim() || !form.option_b_en.trim() || !form.option_c_en.trim() || !form.option_d_en.trim()}
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
