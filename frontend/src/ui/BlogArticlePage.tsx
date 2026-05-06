import { useQuery } from '@tanstack/react-query'
import ReactQuill from 'react-quill'
import { Link, useParams } from 'react-router-dom'

import { apiFetch } from '../lib/api'

import 'react-quill/dist/quill.bubble.css'

type BlogArticle = {
  id: string
  title: string
  content_delta: unknown
  created_at: string
  updated_at: string
}

type BlogArticleResponse = {
  article: BlogArticle
}

export default function BlogArticlePage() {
  const { articleId } = useParams()

  const q = useQuery({
    queryKey: ['blog-article', articleId],
    queryFn: () => apiFetch<BlogArticleResponse>(`/api/blog/articles/${articleId}`),
    enabled: Boolean(articleId),
    retry: false,
  })

  if (!articleId) {
    return <div className="text-sm text-slate-600">Missing article.</div>
  }

  if (q.isLoading) {
    return <div className="text-sm text-slate-600">Loading…</div>
  }

  if (q.isError) {
    return <div className="text-sm text-red-700">{(q.error as Error).message}</div>
  }

  const article = q.data?.article
  if (!article) {
    return <div className="text-sm text-slate-600">Not found.</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold tracking-tight">
              RAAS Learning
            </Link>
            <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" to="/blog">
              Blog
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-2xl font-semibold tracking-tight">{article.title}</div>
          <div className="mt-2 text-xs text-slate-600">Updated: {new Date(article.updated_at).toLocaleString()}</div>

          <div className="prose prose-slate mt-6 max-w-none">
            <ReactQuill readOnly theme="bubble" value={article.content_delta as never} />
          </div>
        </div>
      </main>
    </div>
  )
}
