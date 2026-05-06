import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { jwtRole } from '../lib/jwt'

type BlogArticleSummary = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

type BlogListResponse = {
  articles: BlogArticleSummary[]
}

export default function BlogListPage() {
  const auth = useAuth()
  const role = jwtRole(auth.token)

  const q = useQuery({
    queryKey: ['blog-articles'],
    queryFn: () => apiFetch<BlogListResponse>('/api/blog/articles'),
  })

  if (q.isLoading) {
    return <div className="text-sm text-slate-600">Loading…</div>
  }

  if (q.isError) {
    return <div className="text-sm text-red-700">{(q.error as Error).message}</div>
  }

  const articles = q.data?.articles ?? []

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold tracking-tight">
              RAAS Learning
            </Link>
            <div className="text-sm text-slate-600">Blog</div>
          </div>

          <div className="flex items-center gap-2">
            {role === 'admin' ? (
              <Link
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                to="/blog/new"
              >
                New Article
              </Link>
            ) : null}
            <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" to="/login">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Books & Articles</div>
            <div className="mt-1 text-sm text-slate-600">Published notes and book write-ups.</div>
          </div>
        </div>

        {articles.length === 0 ? (
          <div className="mt-6 rounded-xl border bg-white p-4 text-sm text-slate-600">No articles yet.</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {articles.map((a) => (
              <Link key={a.id} to={`/blog/${a.id}`} className="rounded-xl border bg-white p-4 hover:bg-slate-50">
                <div className="text-sm font-semibold">{a.title}</div>
                <div className="mt-2 text-xs text-slate-600">Updated: {new Date(a.updated_at).toLocaleString()}</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
