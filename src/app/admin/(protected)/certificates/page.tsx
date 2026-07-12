'use client'

import { useState, useEffect } from 'react'
import { Award, Loader2, ExternalLink } from 'lucide-react'

interface StudentRow { id: string; full_name: string | null; student_id?: string | null }
interface CourseRow { id: number; title_en: string; title_te: string | null; is_published: boolean }

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
    load()
  }, [])

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
          Generate a test certificate for any student and course — eligibility checks are bypassed.
          Keep the specimen watermark on unless you are checking the final layout.
        </p>
      </div>

      {error && (
        <div className="bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-4 text-brand-error text-sm">
          {error}
        </div>
      )}

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
