'use client'

import { useEffect, useState } from 'react'
import { BarChart2, TrendingUp, BookOpen, Users, IndianRupee, Layers, GraduationCap } from 'lucide-react'

interface CourseStat {
  id: number
  title: string
  emoji: string
  bgColor: string
  enrollments: number
  revenue: number
}

interface MonthlyPoint {
  label: string
  count: number
}

interface AnalyticsData {
  courseStats: CourseStat[]
  monthlyTrend: MonthlyPoint[]
  totals: {
    courses: number
    enrollments: number
    revenue: number
    lessonCompletions: number
  }
}

interface StudentCourseProgress {
  course_id: number
  title_en: string
  title_te: string
  emoji: string
  bg_color: string
  completed_lessons: number
  total_lessons: number
  progress_pct: number
  enrolled_at: string
}

interface StudentProgress {
  id: string
  full_name: string
  avatar_initials: string
  student_id: number | null
  email: string
  courses: StudentCourseProgress[]
}

function Bar({ value, max, color = '#f0b429' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-brand-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-brand-gold-muted text-xs w-8 text-right">{value}</span>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<StudentProgress[]>([])
  const [studentsLoading, setStudentsLoading] = useState(true)
  const [studentSearch, setStudentSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
    fetch('/api/admin/analytics/student-progress')
      .then(r => r.json())
      .then(d => setStudents(d.students ?? []))
      .finally(() => setStudentsLoading(false))
  }, [])

  const filteredStudents = students.filter(s =>
    s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-brand-gold text-4xl animate-pulse">ॐ</div>
      </div>
    )
  }

  if (!data) {
    return <div className="text-brand-error text-sm">Failed to load analytics.</div>
  }

  const maxEnrollments = Math.max(...data.courseStats.map(c => c.enrollments), 1)
  const maxRevenue     = Math.max(...data.courseStats.map(c => c.revenue), 1)
  const maxMonthly     = Math.max(...data.monthlyTrend.map(m => m.count), 1)

  const SUMMARY = [
    { label: 'Published Courses',    value: data.totals.courses,           icon: BookOpen,     color: 'text-brand-gold' },
    { label: 'Active Enrollments',   value: data.totals.enrollments,       icon: Users,        color: 'text-brand-success' },
    { label: 'Total Revenue',        value: `₹${data.totals.revenue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-blue-400' },
    { label: 'Lesson Completions',   value: data.totals.lessonCompletions, icon: Layers,       color: 'text-purple-400' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart2 className="w-5 h-5 text-brand-gold" />
        <h1 className="text-brand-gold font-bold text-xl">Analytics</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SUMMARY.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-brand-card border border-brand-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-brand-gold-muted text-xs">{s.label}</span>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          )
        })}
      </div>

      {/* Monthly enrollment trend */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="w-4 h-4 text-brand-gold" />
          <h2 className="text-brand-gold font-semibold text-sm">Monthly Enrollments (Last 6 Months)</h2>
        </div>
        <div className="flex items-end gap-2 h-32">
          {data.monthlyTrend.map(m => {
            const pct = maxMonthly > 0 ? (m.count / maxMonthly) * 100 : 0
            return (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-brand-gold text-xs font-medium">{m.count > 0 ? m.count : ''}</span>
                <div className="w-full rounded-t-sm transition-all duration-500" style={{ height: `${Math.max(pct, 2)}%`, backgroundColor: '#f0b429', minHeight: '4px' }} />
                <span className="text-brand-gold-muted text-[10px]">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-course stats */}
      {data.courseStats.length > 0 && (
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-brand-border">
            <h2 className="text-brand-gold font-semibold text-sm">Course Performance</h2>
          </div>
          <div className="divide-y divide-brand-border">
            {data.courseStats.map(course => (
              <div key={course.id} className="px-5 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ backgroundColor: course.bgColor }}
                  >
                    {course.emoji}
                  </div>
                  <span className="text-brand-body text-sm font-medium flex-1 truncate">{course.title}</span>
                  <span className="text-brand-gold-muted text-xs">
                    ₹{course.revenue.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pl-9">
                  <div>
                    <span className="text-brand-gold-muted text-[10px] uppercase tracking-wide">Enrollments</span>
                    <Bar value={course.enrollments} max={maxEnrollments} color="#f0b429" />
                  </div>
                  <div>
                    <span className="text-brand-gold-muted text-[10px] uppercase tracking-wide">Revenue</span>
                    <Bar value={course.revenue} max={maxRevenue} color="#60a5fa" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.courseStats.length === 0 && (
        <div className="text-center py-16 text-brand-gold-muted text-sm">
          No published courses yet. Publish a course to see analytics.
        </div>
      )}

      {/* Per-student lesson progress, per enrolled course */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-brand-gold" />
            <h2 className="text-brand-gold font-semibold text-sm">Student Progress</h2>
          </div>
          <input
            type="search" value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-64 px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted/50 focus:outline-none focus:border-brand-gold transition-colors"
          />
        </div>

        {studentsLoading ? (
          <div className="py-16 text-center text-brand-gold-muted text-sm">Loading…</div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-brand-gold-muted mx-auto mb-3 opacity-40" />
            <p className="text-brand-gold-muted text-sm">
              {studentSearch ? 'No students match your search.' : 'No active enrollments yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border">
            {filteredStudents.map(s => (
              <div key={s.id} className="px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-xs font-bold flex-shrink-0">
                    {s.avatar_initials}
                  </div>
                  <span className="text-brand-body text-sm font-medium">{s.full_name}</span>
                  <span className="text-brand-gold-muted text-xs">{s.email || '—'}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pl-9">
                  {s.courses.map(c => (
                    <div key={c.course_id} className="bg-brand-bg border border-brand-border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{c.emoji}</span>
                        <span className="text-brand-body text-xs font-medium flex-1 truncate">{c.title_en}</span>
                        <span className="text-brand-gold-muted text-[10px] whitespace-nowrap">
                          {c.completed_lessons}/{c.total_lessons}
                        </span>
                      </div>
                      <Bar value={c.completed_lessons} max={Math.max(c.total_lessons, 1)} color="#34d399" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
