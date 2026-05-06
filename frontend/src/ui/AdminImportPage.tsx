import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { apiUpload } from '../lib/api'
import { useAuth } from '../lib/auth'

type ImportResponse = {
  imported_courses: number
  imported_learning_paths: number
}

export default function AdminImportPage() {
  const auth = useAuth()
  const nav = useNavigate()

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResponse | null>(null)

  const onUpload = async () => {
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await apiUpload<ImportResponse>('/api/admin/import/courses', form, auth.token)
      setResult(res)
      nav('/app/admin/courses')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xl font-semibold tracking-tight">Import courses (Excel)</div>
        <div className="mt-1 text-sm text-slate-600">Upload your .xlsx to create courses, lessons, and learning paths.</div>
      </div>

      <div className="rounded-2xl border bg-white p-5">
        <div className="space-y-3">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />

          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            disabled={!file || loading}
            onClick={onUpload}
            type="button"
          >
            {loading ? 'Uploading…' : 'Upload'}
          </button>

          {error ? <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

          {result ? (
            <div className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-800">
              Imported courses: {result.imported_courses}. Imported learning paths: {result.imported_learning_paths}.
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
        If the API returns 401/403, make sure you are signed in with the admin account.
      </div>
    </div>
  )
}
