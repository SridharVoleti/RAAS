import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import ReactQuill from 'react-quill'
import { Link, useNavigate } from 'react-router-dom'

import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'
import { jwtRole } from '../lib/jwt'

import 'react-quill/dist/quill.snow.css'

type CreateBlogArticleRequest = {
  title: string
  content_delta: unknown
}

type BlogArticle = {
  id: string
  title: string
  content_delta: unknown
  created_at: string
  updated_at: string
}

type CreateBlogArticleResponse = {
  article: BlogArticle
}

export default function BlogEditorPage() {
  const auth = useAuth()
  const role = jwtRole(auth.token)
  const nav = useNavigate()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState<unknown>({ ops: [] })

  const canPublish = role === 'admin'

  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link'],
        ['clean'],
      ],
    }),
    [],
  )

  const formats = useMemo(
    () => ['header', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'link'],
    [],
  )

  const publishMutation = useMutation({
    mutationFn: () =>
      apiFetch<CreateBlogArticleResponse>('/api/blog/articles', {
        method: 'POST',
        token: auth.token,
        body: JSON.stringify({ title, content_delta: content } satisfies CreateBlogArticleRequest),
      }),
    onSuccess: (res) => {
      nav(`/blog/${res.article.id}`)
    },
  })

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
            <div className="text-sm text-slate-600">New Article</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border bg-white p-6">
          {!canPublish ? (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">You must be signed in as admin to publish.</div>
          ) : null}

          <div className="mt-4">
            <label className="text-sm font-medium">Title</label>
            <input
              className="mt-2 w-full rounded-md border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter article title"
            />
          </div>

          <div className="mt-5">
            <label className="text-sm font-medium">Text</label>
            <div className="mt-2">
              <ReactQuill
                theme="snow"
                value={content as never}
                onChange={(_html: unknown, _delta: unknown, _source: unknown, editor: unknown) => {
                  const e = editor as { getContents?: () => unknown } | null
                  setContent(e?.getContents?.() ?? { ops: [] })
                }}
                modules={modules}
                formats={formats}
              />
            </div>
          </div>

          {publishMutation.isError ? (
            <div className="mt-4 rounded-md bg-red-50 p-2 text-sm text-red-700">{(publishMutation.error as Error).message}</div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              type="button"
              disabled={!canPublish || !title.trim() || publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              {publishMutation.isPending ? 'Publishing…' : 'Publish'}
            </button>
            <Link className="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50" to="/blog">
              Cancel
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
