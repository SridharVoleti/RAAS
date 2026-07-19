'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, CheckCircle, AlertCircle, GraduationCap, ChevronRight } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { getCourses } from '@/lib/getCourses'
import type { Course } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

interface GuruDetails {
  teacherName: string
  teacherMobile: string
}

interface Declaration {
  course_id: number
  teacher_name: string
  teacher_mobile: string
}

interface RegisteredSubject {
  courseId: number
  title_en: string
  title_te: string | null
  has_exam: boolean
}

const MOBILE_RE = /^\+?\d{7,15}$/

export default function PriorLearningDialog({ open, onClose }: Props) {
  const { lang, t } = useLang()
  const router = useRouter()
  const tp = t.priorLearning

  const [subjects, setSubjects] = useState<Course[]>([])
  const [declared, setDeclared] = useState<Map<number, Declaration>>(new Map())
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<number>>(new Set())
  const [selected, setSelected] = useState<Map<number, GuruDetails>>(new Map())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [registered, setRegistered] = useState<RegisteredSubject[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setRegistered(null)
    setError('')
    setSelected(new Map())
    setLoading(true)

    Promise.all([
      // RAAS-path subjects, straight from the courses table so new courses
      // appear here automatically
      getCourses({ limit: 100 }).catch(() => [] as Course[]),
      fetch('/api/prior-learning')
        .then(res => (res.ok ? res.json() : { declarations: [], enrolledCourseIds: [] }))
        .catch(() => ({ declarations: [], enrolledCourseIds: [] })),
    ]).then(([courses, own]) => {
      setSubjects(courses.filter(c => c.path_id === 1 && c.is_published))
      setDeclared(new Map(
        (own.declarations as Declaration[]).map(d => [d.course_id, d])
      ))
      setEnrolledCourseIds(new Set((own.enrolledCourseIds ?? []) as number[]))
      setLoading(false)
    })
  }, [open])

  if (!open) return null

  function toggle(courseId: number) {
    setSelected(prev => {
      const next = new Map(prev)
      if (next.has(courseId)) next.delete(courseId)
      else next.set(courseId, { teacherName: '', teacherMobile: '' })
      return next
    })
  }

  function setGuru(courseId: number, patch: Partial<GuruDetails>) {
    setSelected(prev => {
      const next = new Map(prev)
      const current = next.get(courseId)
      if (current) next.set(courseId, { ...current, ...patch })
      return next
    })
  }

  const allValid =
    selected.size > 0 &&
    [...selected.values()].every(
      g => g.teacherName.trim().length >= 2 && MOBILE_RE.test(g.teacherMobile.trim())
    )

  async function handleSubmit() {
    if (!allValid || submitting) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/prior-learning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subjects: [...selected.entries()].map(([courseId, g]) => ({
          courseId,
          teacherName: g.teacherName.trim(),
          teacherMobile: g.teacherMobile.trim(),
        })),
      }),
    })

    if (res.ok) {
      const data = await res.json()
      setRegistered(data.subjects)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Something went wrong')
    }
    setSubmitting(false)
  }

  function title(c: { title_en: string; title_te?: string | null }) {
    return lang === 'te' && c.title_te ? c.title_te : c.title_en
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-lg bg-brand-card border border-brand-border rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-brand-gold font-bold text-lg flex items-center gap-2">
            <GraduationCap className="w-5 h-5" />
            {tp.dialogTitle}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-brand-gold-muted hover:text-brand-gold hover:bg-brand-border/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-brand-gold-muted text-xs mb-5">{tp.subtitle}</p>

        {registered ? (
          <div className="py-2">
            <div className="text-center mb-5">
              <CheckCircle className="w-12 h-12 text-brand-success mx-auto mb-3" />
              <p className="text-brand-body text-sm leading-relaxed">{tp.thanks}</p>
            </div>
            <div className="space-y-2">
              {registered.map(s => (
                <div key={s.courseId} className="flex items-center justify-between gap-3 bg-brand-bg border border-brand-border rounded-xl px-4 py-3">
                  <span className="text-brand-body text-sm">{title(s)}</span>
                  {s.has_exam ? (
                    <button
                      onClick={() => router.push(`/exam/${s.courseId}`)}
                      className="flex items-center gap-1 text-brand-gold text-sm font-semibold hover:underline shrink-0"
                    >
                      {tp.takeFinalTest}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-brand-gold-muted text-xs shrink-0">{tp.testComingSoon}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 text-brand-error text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {loading ? (
              <div className="text-center py-8 text-brand-gold text-3xl animate-pulse">ॐ</div>
            ) : subjects.length === 0 ? (
              <p className="text-brand-gold-muted text-sm text-center py-6">{tp.noSubjects}</p>
            ) : (
              <div>
                <p className="text-brand-gold font-semibold text-sm mb-2">{tp.subjectsHeading}</p>
                <div className="space-y-2">
                  {subjects.map(c => {
                    const prior = declared.get(c.id)
                    const enrolled = enrolledCourseIds.has(c.id)
                    const locked = !!prior || enrolled
                    const isChecked = selected.has(c.id)
                    const guru = selected.get(c.id)
                    return (
                      <div key={c.id} className={`border rounded-xl transition-colors ${
                        isChecked ? 'border-brand-gold bg-brand-gold/5' : 'border-brand-border'
                      }`}>
                        <label className={`flex items-center gap-3 px-4 py-3 ${locked ? 'opacity-70' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={locked || isChecked}
                            disabled={locked}
                            onChange={() => toggle(c.id)}
                            className="accent-[#d4a017] w-4 h-4 shrink-0"
                          />
                          <span className="text-brand-body text-sm flex-1">{title(c)}</span>
                          {prior && (
                            <span className="text-xs bg-brand-success/15 text-brand-success px-2 py-0.5 rounded-full shrink-0">
                              {tp.registered} · {prior.teacher_name}
                            </span>
                          )}
                          {!prior && enrolled && (
                            <span className="text-xs bg-brand-gold/15 text-brand-gold px-2 py-0.5 rounded-full shrink-0">
                              {tp.alreadyEnrolled}
                            </span>
                          )}
                        </label>

                        {isChecked && guru && (
                          <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={guru.teacherName}
                              onChange={e => setGuru(c.id, { teacherName: e.target.value })}
                              maxLength={200}
                              placeholder={tp.guruName}
                              className="bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-body text-sm focus:border-brand-gold focus:outline-none"
                            />
                            <input
                              type="tel"
                              value={guru.teacherMobile}
                              onChange={e => setGuru(c.id, { teacherMobile: e.target.value })}
                              maxLength={16}
                              placeholder={tp.guruMobile}
                              className="bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-body text-sm focus:border-brand-gold focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!loading && subjects.length > 0 && (
              <>
                <button
                  onClick={handleSubmit}
                  disabled={!allValid || submitting}
                  className="w-full py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {submitting ? tp.submitting : tp.submit}
                </button>
                {!allValid && (
                  <p className="text-center text-brand-gold-muted text-xs">{tp.selectAtLeastOne}</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
