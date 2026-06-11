'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown, Pencil, Trash2, Plus, X, Check } from 'lucide-react'
import ConfirmModal from './ConfirmModal'
import type { Lesson, QuizQuestion } from '@/types'

type CorrectOption = 'a' | 'b' | 'c' | 'd'
const OPTIONS: CorrectOption[] = ['a', 'b', 'c', 'd']

type QForm = {
  question_en: string; question_te: string
  option_a_en: string; option_a_te: string
  option_b_en: string; option_b_te: string
  option_c_en: string; option_c_te: string
  option_d_en: string; option_d_te: string
  correct_option: CorrectOption
}

const emptyForm: QForm = {
  question_en: '', question_te: '',
  option_a_en: '', option_a_te: '',
  option_b_en: '', option_b_te: '',
  option_c_en: '', option_c_te: '',
  option_d_en: '', option_d_te: '',
  correct_option: 'a',
}

function toQForm(q: QuizQuestion): QForm {
  return {
    question_en: q.question_en, question_te: q.question_te ?? '',
    option_a_en: q.option_a_en, option_a_te: q.option_a_te ?? '',
    option_b_en: q.option_b_en, option_b_te: q.option_b_te ?? '',
    option_c_en: q.option_c_en, option_c_te: q.option_c_te ?? '',
    option_d_en: q.option_d_en, option_d_te: q.option_d_te ?? '',
    correct_option: q.correct_option,
  }
}

interface Props {
  lessonId: number
  /** All lessons of the course, used to move a question to another lesson */
  lessons?: Lesson[]
}

export default function QuizManager({ lessonId, lessons = [] }: Props) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<QForm>({ ...emptyForm })
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState<QForm>({ ...emptyForm })
  const [deleteTarget, setDeleteTarget] = useState<QuizQuestion | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const inputCls = 'w-full px-2.5 py-1.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-xs placeholder:text-brand-gold-muted/40 focus:outline-none focus:border-brand-gold transition-colors'

  useEffect(() => {
    fetchQuestions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId])

  async function fetchQuestions() {
    setLoading(true)
    const res = await fetch(`/api/admin/lessons/${lessonId}/quiz`)
    const data = await res.json()
    setQuestions(data)
    setLoading(false)
  }

  function validateForm(f: QForm): string {
    if (!f.question_en.trim()) return 'Question (English) is required.'
    if (!f.option_a_en.trim() || !f.option_b_en.trim() || !f.option_c_en.trim() || !f.option_d_en.trim())
      return 'All four option texts (English) are required.'
    return ''
  }

  async function handleAdd() {
    const err = validateForm(addForm)
    if (err) { setError(err); return }
    setError('')
    setSaving(true)
    const res = await fetch(`/api/admin/lessons/${lessonId}/quiz`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...addForm, order_index: questions.length + 1 }),
    })
    setSaving(false)
    if (res.ok) { setShowAdd(false); setAddForm({ ...emptyForm }); fetchQuestions() }
    else { const d = await res.json(); setError(d.error || 'Failed to add question') }
  }

  async function handleEditSave(q: QuizQuestion) {
    const err = validateForm(editForm)
    if (err) { setError(err); return }
    setError('')
    setSaving(true)
    const res = await fetch(`/api/admin/quiz/${q.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, order_index: q.order_index }),
    })
    setSaving(false)
    if (res.ok) { setEditingId(null); fetchQuestions() }
    else { const d = await res.json(); setError(d.error || 'Update failed') }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    await fetch(`/api/admin/quiz/${deleteTarget.id}`, { method: 'DELETE' })
    setSaving(false)
    setDeleteTarget(null)
    fetchQuestions()
  }

  async function handleMove(q: QuizQuestion, targetLessonId: number) {
    if (targetLessonId === lessonId) return
    setError('')
    setSaving(true)
    const res = await fetch(`/api/admin/quiz/${q.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...toQForm(q), order_index: q.order_index, lesson_id: targetLessonId }),
    })
    setSaving(false)
    if (res.ok) fetchQuestions()
    else { const d = await res.json(); setError(d.error || 'Failed to move question') }
  }

  async function handleReorder(q: QuizQuestion, dir: 'up' | 'down') {
    const sorted = [...questions].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex(x => x.id === q.id)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    await Promise.all([
      fetch(`/api/admin/quiz/${q.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...toQForm(q), order_index: other.order_index }) }),
      fetch(`/api/admin/quiz/${other.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...toQForm(other), order_index: q.order_index }) }),
    ])
    fetchQuestions()
  }

  function QuestionFormUI({ form, setForm, onSave, onCancel, saveLabel, formKey }: {
    form: QForm
    setForm: React.Dispatch<React.SetStateAction<QForm>>
    onSave: () => void
    onCancel: () => void
    saveLabel: string
    formKey: string
  }) {
    return (
      <div className="p-4 bg-brand-bg/60 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="sm:col-span-2">
            <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Question (English) *</label>
            <textarea rows={2} value={form.question_en} onChange={e => setForm(f => ({ ...f, question_en: e.target.value }))} className={inputCls + ' resize-none'} placeholder="Type the question in English" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Question (Telugu)</label>
            <textarea rows={2} value={form.question_te} onChange={e => setForm(f => ({ ...f, question_te: e.target.value }))} className={inputCls + ' resize-none'} placeholder="Optional Telugu translation" />
          </div>
        </div>

        {OPTIONS.map(opt => (
          <div key={opt} className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-brand-border rounded-lg p-2">
            <div className="sm:col-span-2 flex items-center gap-2 mb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name={`correct-${formKey}`} value={opt}
                  checked={form.correct_option === opt}
                  onChange={() => setForm(f => ({ ...f, correct_option: opt }))}
                  className="accent-yellow-400" />
                <span className="text-brand-gold text-xs font-semibold uppercase">Option {opt}</span>
              </label>
              {form.correct_option === opt && (
                <span className="text-brand-success text-[10px] font-medium">✓ Correct answer</span>
              )}
            </div>
            <div>
              <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Option {opt.toUpperCase()} (English) *</label>
              <input value={form[`option_${opt}_en` as keyof QForm] as string}
                onChange={e => setForm(f => ({ ...f, [`option_${opt}_en`]: e.target.value }))}
                className={inputCls} placeholder={`Option ${opt.toUpperCase()} in English`} />
            </div>
            <div>
              <label className="text-brand-gold-muted text-[10px] mb-0.5 block">Option {opt.toUpperCase()} (Telugu)</label>
              <input value={form[`option_${opt}_te` as keyof QForm] as string}
                onChange={e => setForm(f => ({ ...f, [`option_${opt}_te`]: e.target.value }))}
                className={inputCls} placeholder="Optional Telugu" />
            </div>
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button onClick={onSave} disabled={saving}
            className="flex items-center gap-1 px-3 py-1.5 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg disabled:opacity-50">
            <Check className="w-3 h-3" /> {saving ? 'Saving…' : saveLabel}
          </button>
          <button onClick={onCancel}
            className="flex items-center gap-1 px-3 py-1.5 border border-brand-border rounded-lg text-brand-body text-xs hover:border-brand-gold transition-colors">
            <X className="w-3 h-3" /> Cancel
          </button>
        </div>
      </div>
    )
  }

  const sorted = [...questions].sort((a, b) => a.order_index - b.order_index)
  const sortedLessons = [...lessons].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
        <h3 className="text-brand-gold font-semibold text-sm">
          Quiz Questions <span className="text-brand-gold-muted font-normal">({questions.length})</span>
        </h3>
        <button onClick={() => { setShowAdd(true); setError('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Question
        </button>
      </div>

      {error && (
        <div className="px-5 py-3 bg-brand-error/10 border-b border-brand-error/20 text-brand-error text-xs">{error}</div>
      )}

      {loading ? (
        <div className="px-5 py-8 text-center text-brand-gold-muted text-sm">Loading questions…</div>
      ) : sorted.length === 0 && !showAdd ? (
        <div className="px-5 py-8 text-center text-brand-gold-muted text-sm">
          No questions yet. Click <span className="text-brand-gold">Add Question</span> to create the first one — it will appear as &ldquo;Test your knowledge&rdquo; under this lesson.
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-[28px_1fr_60px_140px_80px] gap-2 px-4 py-2 text-brand-gold-muted text-[10px] uppercase font-medium border-b border-brand-border bg-brand-bg">
            <span>#</span><span>Question (EN)</span><span>Answer</span><span>Lesson</span><span className="text-right">Actions</span>
          </div>

          {sorted.map((q, idx) => (
            <div key={q.id} className="border-b border-brand-border last:border-0">
              {editingId === q.id ? (
                <QuestionFormUI
                  form={editForm}
                  setForm={setEditForm}
                  onSave={() => handleEditSave(q)}
                  onCancel={() => { setEditingId(null); setError('') }}
                  saveLabel="Save"
                  formKey={String(q.id)}
                />
              ) : (
                <div className="grid grid-cols-[28px_1fr_60px_140px_80px] gap-2 px-4 py-3 items-center hover:bg-brand-bg/40 transition-colors">
                  <span className="text-brand-gold-muted text-xs font-mono">{idx + 1}</span>
                  <p className="text-brand-body text-xs truncate">{q.question_en}</p>
                  <span className="text-brand-gold text-xs font-semibold uppercase text-center">{q.correct_option}</span>
                  {sortedLessons.length > 1 ? (
                    <select
                      value={lessonId}
                      disabled={saving}
                      onChange={e => handleMove(q, Number(e.target.value))}
                      title="Move this question to another lesson"
                      className="w-full px-1.5 py-1 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-[11px] focus:outline-none focus:border-brand-gold transition-colors disabled:opacity-50"
                    >
                      {sortedLessons.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.order_index}. {l.title_en.length > 18 ? l.title_en.slice(0, 18) + '…' : l.title_en}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-brand-gold-muted text-[11px]">—</span>
                  )}
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => handleReorder(q, 'up')} disabled={idx === 0}
                      className="p-1 text-brand-gold-muted hover:text-brand-gold disabled:opacity-30 transition-colors">
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleReorder(q, 'down')} disabled={idx === sorted.length - 1}
                      className="p-1 text-brand-gold-muted hover:text-brand-gold disabled:opacity-30 transition-colors">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditingId(q.id); setEditForm(toQForm(q)); setError('') }}
                      className="p-1 text-brand-gold-muted hover:text-brand-gold transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(q)}
                      className="p-1 text-brand-gold-muted hover:text-brand-error transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {showAdd && (
            <div className="border-t border-brand-border">
              <div className="px-4 pt-4 pb-0">
                <h4 className="text-brand-gold text-xs font-semibold">New Question</h4>
              </div>
              <QuestionFormUI
                form={addForm}
                setForm={setAddForm}
                onSave={handleAdd}
                onCancel={() => { setShowAdd(false); setError('') }}
                saveLabel="Add Question"
                formKey="new"
              />
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Question"
          message={`Delete this question? "${deleteTarget.question_en.slice(0, 80)}${deleteTarget.question_en.length > 80 ? '…' : ''}" This cannot be undone.`}
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
