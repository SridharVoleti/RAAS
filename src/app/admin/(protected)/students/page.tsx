'use client'

import { useEffect, useState } from 'react'
import { Users, ChevronDown, ChevronRight } from 'lucide-react'

interface Student {
  id: string; full_name: string; email: string
  avatar_initials: string; created_at: string; enrolled_courses: number
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/students')
      .then(r => r.json())
      .then(d => { setStudents(d.items ?? []); setLoading(false) })
  }, [])

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-brand-gold font-bold text-xl">Students</h1>
          <p className="text-brand-gold-muted text-sm mt-1">{students.length} registered student{students.length !== 1 ? 's' : ''}</p>
        </div>
        <input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-64 px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted/50 focus:outline-none focus:border-brand-gold transition-colors"
        />
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-brand-gold-muted text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-brand-gold-muted mx-auto mb-3 opacity-40" />
            <p className="text-brand-gold-muted text-sm">{search ? 'No students match your search.' : 'No students yet.'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-brand-gold-muted text-xs uppercase font-medium border-b border-brand-border bg-brand-bg">
                <th className="text-left px-5 py-3">Student</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-right px-5 py-3">Enrolled</th>
                <th className="text-right px-5 py-3">Joined</th>
                <th className="px-5 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <>
                  <tr key={s.id}
                    onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                    className={`border-b border-brand-border cursor-pointer hover:bg-brand-bg/60 transition-colors ${i % 2 === 0 ? '' : 'bg-brand-bg/30'} ${expanded === s.id ? 'bg-brand-bg/60' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-xs font-bold flex-shrink-0">
                          {s.avatar_initials}
                        </div>
                        <span className="text-brand-body font-medium">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-brand-gold-muted text-xs">{s.email || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="px-2 py-0.5 bg-brand-gold/10 text-brand-gold text-xs rounded-full font-medium">
                        {s.enrolled_courses} course{s.enrolled_courses !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-brand-gold-muted text-xs">
                      {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-3 text-center text-brand-gold-muted">
                      {expanded === s.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </td>
                  </tr>
                  {expanded === s.id && (
                    <tr key={`${s.id}-detail`} className="bg-brand-bg/40">
                      <td colSpan={5} className="px-8 py-3 text-brand-gold-muted text-xs border-b border-brand-border">
                        Student ID: <span className="font-mono text-brand-body">{s.id}</span>
                        <span className="mx-3">·</span>
                        {s.enrolled_courses === 0
                          ? 'No active enrollments'
                          : `${s.enrolled_courses} active enrollment${s.enrolled_courses !== 1 ? 's' : ''}`
                        }
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
