import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'

type LearningPathSummary = {
  id: string
  title: string
  description: string
  price: number
  course_count: number
}

type LearningPathsResponse = {
  learning_paths: LearningPathSummary[]
}

type LearningPathOutlineResponse = {
  learning_path: { id: string; title: string; description: string }
  courses: Array<{
    id: string
    title: string
    description: string
    lessons: Array<{ id: string; title: string }>
  }>
}

export default function LearningPathsPage() {
  const auth = useAuth()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const pathsQuery = useQuery({
    queryKey: ['learning-paths'],
    queryFn: () => apiFetch<LearningPathsResponse>('/api/learner/learning-paths', { token: auth.token }),
  })

  const outlineQuery = useQuery({
    queryKey: ['learning-path-outline', expandedId],
    queryFn: () =>
      apiFetch<LearningPathOutlineResponse>(`/api/learner/public/learning-path/${expandedId}/outline`, { token: auth.token }),
    enabled: Boolean(expandedId),
  })

  const learningPaths = useMemo(() => pathsQuery.data?.learning_paths ?? [], [pathsQuery.data])

  if (pathsQuery.isLoading) {
    return <div className="text-sm text-slate-600">Loading…</div>
  }

  if (pathsQuery.isError) {
    return <div className="text-sm text-red-700">{(pathsQuery.error as Error).message}</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-base font-semibold">Learning Paths</div>
        <div className="mt-1 text-sm text-slate-600">Browse learning paths and view the courses inside each path.</div>
      </div>

      {learningPaths.length === 0 ? (
        <div className="text-sm text-slate-600">No learning paths available.</div>
      ) : (
        <div className="space-y-4">
          {learningPaths.map((lp) => {
            const expanded = expandedId === lp.id

            return (
              <div key={lp.id} className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{lp.title}</div>
                    <div className="mt-1 text-sm text-slate-600">{lp.description}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {lp.course_count} courses · ₹{lp.price}
                    </div>
                  </div>

                  <button
                    className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
                    onClick={() => setExpandedId(expanded ? null : lp.id)}
                  >
                    {expanded ? 'Hide courses' : 'View courses'}
                  </button>
                </div>

                {expanded ? (
                  <div className="mt-4">
                    {outlineQuery.isLoading ? (
                      <div className="text-sm text-slate-600">Loading courses…</div>
                    ) : outlineQuery.isError ? (
                      <div className="text-sm text-red-700">{(outlineQuery.error as Error).message}</div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {(outlineQuery.data?.courses ?? []).map((c) => (
                          <Link
                            key={c.id}
                            className="rounded-lg border bg-slate-50 p-3 hover:bg-slate-100"
                            to={`/app/course/${c.id}`}
                          >
                            <div className="text-sm font-semibold">{c.title}</div>
                            <div className="mt-1 line-clamp-2 text-xs text-slate-600">{c.description}</div>
                            <div className="mt-2 text-xs text-slate-500">{c.lessons.length} lessons</div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
