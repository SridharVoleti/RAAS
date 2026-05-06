import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'

type AdminCourseListItem = {
  id: string
  title: string
  description: string
  price: number
  lesson_count: number
}

type CoursesResponse = {
  courses: AdminCourseListItem[]
}

export default function AdminCoursesPage() {
  const auth = useAuth()

  const q = useQuery({
    queryKey: ['admin-courses'],
    queryFn: () => apiFetch<CoursesResponse>('/api/admin/courses', { token: auth.token }),
  })

  if (q.isLoading) {
    return <div className="text-sm text-slate-600">Loading…</div>
  }

  if (q.isError) {
    return <div className="text-sm text-red-700">{(q.error as Error).message}</div>
  }

  const courses = q.data?.courses ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold tracking-tight">Courses</div>
          <div className="mt-1 text-sm text-slate-600">Imported courses and their lesson counts.</div>
        </div>
        <Link
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          to="/app/admin/import"
        >
          Import Excel
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-slate-600">No courses yet. Import an Excel.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {courses.map((c) => (
            <Link
              key={c.id}
              to={`/app/admin/course/${c.id}`}
              className="rounded-xl border bg-white p-4 hover:bg-slate-50"
            >
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="mt-1 line-clamp-2 text-xs text-slate-600">{c.description}</div>
              <div className="mt-3 text-xs text-slate-600">Lessons: {c.lesson_count}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
