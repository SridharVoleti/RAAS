import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'

type CourseDetail = {
  id: string
  title: string
  description: string
  price: number
  lessons: Array<{ id: string; title: string; youtube_id: string }>
}

type CourseResponse = {
  course: CourseDetail
}

export default function AdminCourseDetailPage() {
  const { courseId } = useParams()
  const auth = useAuth()
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null)

  const q = useQuery({
    queryKey: ['admin-course', courseId],
    queryFn: () => apiFetch<CourseResponse>(`/api/admin/courses/${courseId}`, { token: auth.token }),
    enabled: Boolean(courseId),
  })

  if (!courseId) {
    return <div className="text-sm text-slate-600">Missing course.</div>
  }

  if (q.isLoading) {
    return <div className="text-sm text-slate-600">Loading…</div>
  }

  if (q.isError) {
    return <div className="text-sm text-red-700">{(q.error as Error).message}</div>
  }

  const course = q.data?.course
  if (!course) {
    return <div className="text-sm text-slate-600">No data.</div>
  }

  const activeLesson = activeLessonId ? course.lessons.find((l) => l.id === activeLessonId) ?? null : null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-semibold tracking-tight">{course.title}</div>
          <div className="mt-1 text-sm text-slate-600">{course.description}</div>
        </div>
        <Link className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50" to="/app/admin/courses">
          Back to courses
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm font-semibold">Lessons</div>
          <div className="mt-1 text-sm text-slate-600">Video IDs are shown only to admins.</div>

          <div className="mt-4 space-y-2">
            {course.lessons.map((l, idx) => {
              const isActive = l.id === activeLessonId
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setActiveLessonId(l.id)}
                  className={
                    'w-full rounded-lg border p-3 text-left ' +
                    (isActive ? 'border-slate-900 bg-slate-50' : 'bg-white hover:bg-slate-50')
                  }
                >
                  <div className="text-sm font-semibold">
                    {idx + 1}. {l.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">
                    Video ID: <span className="font-mono">{l.youtube_id}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm font-semibold">Preview player</div>
          <div className="mt-1 text-sm text-slate-600">Click a lesson to preview playback.</div>

          <div className="mt-4">
            {!activeLesson ? (
              <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">Select a lesson to preview.</div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border bg-white p-2">
                  <iframe
                    title={activeLesson.title}
                    className="aspect-[21/9] w-full rounded-md"
                    src={`https://www.youtube-nocookie.com/embed/${activeLesson.youtube_id}?rel=0&controls=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="text-xs text-slate-600">
                  Admin preview does not track completion/unlock. Use the learner player to test gating.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
