import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'

type MeResponse = {
  user: { id: string; email: string; role: string }
  learning_paths: Array<{
    id: string
    title: string
    description: string
    courses: Array<{ id: string; title: string; description: string }>
  }>
}

export default function DashboardPage() {
  const auth = useAuth()

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<MeResponse>('/api/learner/me', { token: auth.token }),
  })

  if (meQuery.isLoading) {
    return <div className="text-sm text-slate-600">Loading…</div>
  }

  if (meQuery.isError) {
    return <div className="text-sm text-red-700">{(meQuery.error as Error).message}</div>
  }

  const me = meQuery.data
  if (!me) {
    return <div className="text-sm text-slate-600">No data.</div>
  }

  if (me.user.role === 'admin') {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-sm text-slate-600">Signed in as</div>
          <div className="text-base font-semibold">{me.user.email}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm font-semibold">Admin Console</div>
          <div className="mt-1 text-sm text-slate-600">Import courses and manage enrollments.</div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              to="/app/admin/import"
            >
              Upload Excel
            </Link>
            <Link className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50" to="/app/dashboard">
              Learner view
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-slate-600">Signed in as</div>
        <div className="text-base font-semibold">{me.user.email}</div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <div className="text-sm font-semibold">Your Learning Paths</div>
        <div className="mt-1 text-sm text-slate-600">Only the courses inside your purchased paths are shown.</div>

        <div className="mt-4 space-y-6">
          {me.learning_paths.length === 0 ? (
            <div className="text-sm text-slate-600">No active learning paths yet.</div>
          ) : (
            me.learning_paths.map((lp) => (
              <div key={lp.id} className="rounded-xl border bg-slate-50 p-4">
                <div className="text-sm font-semibold">{lp.title}</div>
                <div className="mt-1 text-sm text-slate-600">{lp.description}</div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {lp.courses.map((c) => (
                    <Link
                      key={c.id}
                      className="rounded-lg border bg-white p-3 hover:bg-slate-50"
                      to={`/app/course/${c.id}`}
                    >
                      <div className="text-sm font-semibold">{c.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-slate-600">{c.description}</div>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
