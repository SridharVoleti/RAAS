'use client'

import { useState, useEffect, useCallback } from 'react'
import { GraduationCap, Loader2, Phone } from 'lucide-react'

interface Registration {
  id: number
  user_id: string
  course_id: number
  teacher_name: string
  teacher_mobile: string
  book_name: string
  created_at: string
  student_name: string
  courses?: { title_en: string } | null
}

export default function AdminPriorLearningPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/prior-learning')
      if (!res.ok) throw new Error('Failed to load registrations')
      const data = await res.json()
      setRegistrations(data.declarations)
    } catch {
      setError('Failed to load guru-learning registrations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-brand-gold font-bold text-2xl flex items-center gap-2">
          <GraduationCap className="w-6 h-6" />
          Guru Learnings
        </h1>
        <p className="text-brand-gold-muted text-sm mt-1">
          Students who declared subjects learnt from an external guru. Contact the guru to verify.
        </p>
      </div>

      {error && (
        <div className="bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-4 text-brand-error text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-brand-gold-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : registrations.length === 0 ? (
        <div className="text-center py-16 text-brand-gold-muted text-sm">
          No guru-learning registrations yet.
        </div>
      ) : (
        <div className="overflow-x-auto bg-brand-card border border-brand-border rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-left text-brand-gold-muted text-xs">
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Guru</th>
                <th className="px-4 py-3 font-medium">Guru Mobile</th>
                <th className="px-4 py-3 font-medium">Registered</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map(r => (
                <tr key={r.id} className="border-b border-brand-border/50 last:border-0">
                  <td className="px-4 py-3 text-brand-body">{r.student_name}</td>
                  <td className="px-4 py-3 text-brand-gold font-medium">
                    {r.courses?.title_en ?? r.book_name}
                  </td>
                  <td className="px-4 py-3 text-brand-body">{r.teacher_name}</td>
                  <td className="px-4 py-3 text-brand-body">
                    <a
                      href={`tel:${r.teacher_mobile}`}
                      className="flex items-center gap-1.5 text-brand-gold hover:underline"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {r.teacher_mobile}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-brand-gold-muted text-xs">
                    {new Date(r.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
