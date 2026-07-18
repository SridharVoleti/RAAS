'use client'

import { useState, useEffect } from 'react'
import { Award, Loader2, ExternalLink, ChevronDown, ChevronUp, Download, Users } from 'lucide-react'

interface StudentRow { id: string; full_name: string | null; student_id?: string | null }
interface CourseRow { id: number; title_en: string; title_te: string | null; is_published: boolean }

interface AwardSummary {
  courseId: number
  title_en: string
  title_te: string | null
  emoji: string
  awardedCount: number
}

interface AwardedStudentRow {
  userId: string
  studentName: string
  studentId: string | null
  track: 'course' | 'exam'
  completedAt: string
  examScore: number | null
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AdminCertificatesPage() {
  const [students, setStudents] = useState<StudentRow[]>([])
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [userId, setUserId] = useState('')
  const [customName, setCustomName] = useState('')
  const [courseId, setCourseId] = useState('')
  const [date, setDate] = useState(today())
  const [specimen, setSpecimen] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const [awards, setAwards] = useState<AwardSummary[]>([])
  const [awardsLoading, setAwardsLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detailByCourse, setDetailByCourse] = useState<Record<number, AwardedStudentRow[]>>({})
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [studentsRes, coursesRes] = await Promise.all([
          fetch('/api/admin/students?limit=100'),
          fetch('/api/admin/courses'),
        ])
        if (!studentsRes.ok || !coursesRes.ok) throw new Error('load failed')
        const studentsData = await studentsRes.json()
        const coursesData: CourseRow[] = await coursesRes.json()
        setStudents(studentsData.items ?? [])
        setCourses(coursesData)
      } catch {
        setError('Failed to load students or courses.')
      } finally {
        setLoading(false)
      }
    }
    async function loadAwards() {
      try {
        const res = await fetch('/api/admin/certificates')
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        setAwards(data.courses ?? [])
      } catch {
        setError('Failed to load awarded certificates.')
      } finally {
        setAwardsLoading(false)
      }
    }
    load()
    loadAwards()
  }, [])

  async function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!detailByCourse[id]) {
      setDetailLoading(true)
      try {
        const res = await fetch(`/api/admin/certificates/${id}`)
        if (res.ok) {
          const data = await res.json()
          setDetailByCourse(prev => ({ ...prev, [id]: data.students ?? [] }))
        }
      } finally {
        setDetailLoading(false)
      }
    }
  }

  const canGenerate = courseId !== '' && (customName.trim() !== '' || userId !== '')

  function buildUrl(): string {
    const params = new URLSearchParams({ courseId })
    if (customName.trim()) params.set('name', customName.trim())
    else params.set('userId', userId)
    if (date) params.set('date', date)
    if (!specimen) params.set('specimen', '0')
    return `/api/admin/certificate-preview?${params.toString()}`
  }

  function handleGenerate() {
    if (!canGenerate) return
    setPreviewUrl(buildUrl())
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-brand-gold-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-brand-gold font-bold text-2xl flex items-center gap-2">
          <Award className="w-6 h-6" />
          Certificates
        </h1>
        <p className="text-brand-gold-muted text-sm mt-1">
          Certificates awarded per course, and a test generator.
        </p>
      </div>

      {error && (
        <div className="bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-4 text-brand-error text-sm">
          {error}
        </div>
      )}

      {/* ── Awarded certificates by course ─────────────────── */}
      <h2 className="text-brand-gold font-semibold text-lg flex items-center gap-2 mb-3">
        <Users className="w-5 h-5" />
        Awarded Certificates
      </h2>
      {awardsLoading ? (
        <div className="flex items-center justify-center py-10 text-brand-gold-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : awards.length === 0 ? (
        <p className="text-brand-gold-muted text-sm mb-8">
          No courses in a certificate-enabled path yet. Enable certificates on a path in Admin → Paths.
        </p>
      ) : (
        <div className="space-y-3 mb-10">
          {awards.map(a => {
            const expanded = expandedId === a.courseId
            const detail = detailByCourse[a.courseId]
            return (
              <div key={a.courseId} className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpand(a.courseId)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-brand-border/20 transition-colors"
                >
                  <span className="text-2xl leading-none">{a.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-brand-gold font-semibold text-sm">{a.title_te ?? a.title_en}</span>
                    {a.title_te && <span className="text-brand-gold-muted text-xs ml-2">{a.title_en}</span>}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    a.awardedCount > 0 ? 'bg-brand-gold/15 text-brand-gold' : 'bg-brand-border text-brand-gold-muted'
                  }`}>
                    {a.awardedCount} awarded
                  </span>
                  {expanded ? <ChevronUp className="w-4 h-4 text-brand-gold-muted" /> : <ChevronDown className="w-4 h-4 text-brand-gold-muted" />}
                </button>

                {expanded && (
                  <div className="border-t border-brand-border px-4 py-4">
                    {detailLoading && !detail ? (
                      <div className="flex items-center justify-center py-6 text-brand-gold-muted">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : !detail || detail.length === 0 ? (
                      <p className="text-brand-gold-muted text-sm">No certificates awarded for this course yet.</p>
                    ) : (
                      <>
                        <div className="flex justify-end mb-3">
                          <a
                            href={`/api/admin/certificates/${a.courseId}?format=csv`}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-gold text-brand-gold text-xs font-semibold rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Export CSV
                          </a>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-brand-gold-muted text-xs border-b border-brand-border">
                                <th className="text-left py-2 pr-4 font-semibold">Student</th>
                                <th className="text-left py-2 pr-4 font-semibold">Student ID</th>
                                <th className="text-left py-2 pr-4 font-semibold">Track</th>
                                <th className="text-left py-2 pr-4 font-semibold">Completed On</th>
                                <th className="text-left py-2 font-semibold">Exam Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detail.map(s => (
                                <tr key={s.userId} className="border-b border-brand-border/50 text-brand-body">
                                  <td className="py-2 pr-4">{s.studentName}</td>
                                  <td className="py-2 pr-4 text-brand-gold-muted">{s.studentId ?? '—'}</td>
                                  <td className="py-2 pr-4">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                      s.track === 'exam'
                                        ? 'bg-brand-gold/15 text-brand-gold'
                                        : 'bg-brand-success/15 text-brand-success'
                                    }`}>
                                      {s.track === 'exam' ? 'Final Exam' : 'Course'}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-4">
                                    {s.completedAt ? new Date(s.completedAt).toLocaleDateString('en-IN', {
                                      day: 'numeric', month: 'short', year: 'numeric',
                                    }) : '—'}
                                  </td>
                                  <td className="py-2 text-brand-gold-muted">{s.examScore ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Test generator ─────────────────────────────────── */}
      <h2 className="text-brand-gold font-semibold text-lg mb-1">Test Generator</h2>
      <p className="text-brand-gold-muted text-sm mb-3">
        Generate a test certificate for any student and course — eligibility checks are bypassed.
        Keep the specimen watermark on unless you are checking the final layout.
      </p>
      <div className="bg-brand-card border border-brand-border rounded-xl p-5 max-w-2xl space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-brand-gold-muted text-xs font-semibold mb-1.5">Student</label>
            <select
              value={userId}
              onChange={e => { setUserId(e.target.value); setCustomName('') }}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-body focus:border-brand-gold outline-none"
            >
              <option value="">— select a student —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.full_name ?? 'Unnamed'}{s.student_id ? ` (${s.student_id})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-brand-gold-muted text-xs font-semibold mb-1.5">…or type any name</label>
            <input
              type="text"
              value={customName}
              onChange={e => { setCustomName(e.target.value); if (e.target.value) setUserId('') }}
              placeholder="e.g. శ్రీధర్ వోలేటి / Sridhar Voleti"
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-body focus:border-brand-gold outline-none placeholder:text-brand-gold-muted/50"
            />
          </div>
          <div>
            <label className="block text-brand-gold-muted text-xs font-semibold mb-1.5">Course</label>
            <select
              value={courseId}
              onChange={e => setCourseId(e.target.value)}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-body focus:border-brand-gold outline-none"
            >
              <option value="">— select a course —</option>
              {courses.map(c => (
                <option key={c.id} value={String(c.id)}>
                  {c.title_te ?? c.title_en}{!c.is_published ? ' (draft)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-brand-gold-muted text-xs font-semibold mb-1.5">Completion date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-body focus:border-brand-gold outline-none"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-brand-body cursor-pointer select-none">
          <input
            type="checkbox"
            checked={specimen}
            onChange={e => setSpecimen(e.target.checked)}
            className="accent-brand-gold w-4 h-4"
          />
          Specimen watermark
        </label>

        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="px-5 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Generate Certificate
          </button>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-gold text-sm hover:underline flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in new tab
            </a>
          )}
        </div>
      </div>

      {previewUrl && (
        <iframe
          src={previewUrl}
          title="Certificate preview"
          className="mt-6 w-full max-w-4xl aspect-[1600/1135] rounded-xl border border-brand-border bg-white"
        />
      )}
    </div>
  )
}
