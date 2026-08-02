'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'

interface CourseStudent {
  id: string
  full_name: string
  avatar_initials: string
  student_id: number | null
  username: string | null
  mobile: string | null
  isd_code: string
  city: string | null
  country: string
  email: string
  enrolled_at: string
  is_active: boolean
  activated_at: string | null
}

interface CourseInfo {
  id: number
  title_en: string
  title_te: string
  slug: string
}

export default function CourseStudentsPage() {
  const params = useParams<{ id: string }>()
  const [course, setCourse] = useState<CourseInfo | null>(null)
  const [students, setStudents] = useState<CourseStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch(`/api/admin/courses/${params.id}/students`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok) { setError(data.error ?? 'Failed to load'); return }
        setCourse(data.course)
        setStudents(data.items ?? [])
      })
      .finally(() => setLoading(false))
  }, [params.id])

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/courses" className="inline-flex items-center gap-1.5 text-brand-gold-muted hover:text-brand-gold text-sm transition-colors mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Courses
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-brand-gold font-bold text-xl">
              {course ? course.title_en : 'Enrolled Students'}
            </h1>
            <p className="text-brand-gold-muted text-sm mt-1">
              {students.length} student{students.length !== 1 ? 's' : ''} enrolled
            </p>
          </div>
          <input
            type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-64 px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted/50 focus:outline-none focus:border-brand-gold transition-colors"
          />
        </div>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-brand-gold-muted text-sm">Loading…</div>
        ) : error ? (
          <div className="py-16 text-center text-brand-error text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-brand-gold-muted mx-auto mb-3 opacity-40" />
            <p className="text-brand-gold-muted text-sm">{search ? 'No students match your search.' : 'No one has enrolled in this course yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="text-brand-gold-muted text-xs uppercase font-medium border-b border-brand-border bg-brand-bg">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Mobile</th>
                  <th className="text-left px-4 py-3">City</th>
                  <th className="text-left px-4 py-3">Country</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-brand-border last:border-0 ${i % 2 === 0 ? '' : 'bg-brand-bg/30'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-[10px] font-bold flex-shrink-0">
                          {s.avatar_initials}
                        </div>
                        <span className="text-brand-body">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-gold-muted text-xs">{s.email || '—'}</td>
                    <td className="px-4 py-3 text-brand-body text-xs">{s.mobile ? `${s.isd_code} ${s.mobile}` : '—'}</td>
                    <td className="px-4 py-3 text-brand-body text-xs">{s.city || '—'}</td>
                    <td className="px-4 py-3 text-brand-body text-xs">{s.country || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        s.is_active
                          ? 'text-brand-success border-brand-success bg-brand-success/10'
                          : 'text-brand-gold-muted border-brand-border bg-brand-border/30'
                      }`}>
                        {s.is_active ? 'Active' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-brand-gold-muted text-xs whitespace-nowrap">
                      {new Date(s.enrolled_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
