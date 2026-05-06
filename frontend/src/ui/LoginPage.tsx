import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'

type LoginResponse = {
  token: string
  user: { id: string; email: string; role: string }
}

export default function LoginPage() {
  const auth = useAuth()
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const emailToUse = email
      .trim()
      .replace(/\s+/g, '')
      .replace(/\u200B/g, '')
      .replace(/＠/g, '@')
    if (!emailToUse.includes('@')) {
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    try {
      const res = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: emailToUse, password }),
      })
      auth.setToken(res.token)
      nav('/app/dashboard')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-slate-600">Use your email and password to continue.</p>

          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            <label className="block">
              <div className="text-sm font-medium">Email</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="text"
                inputMode="email"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <div className="text-sm font-medium">Password</div>
              <input
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>

            {error ? <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</div> : null}

            <button
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-4 text-xs text-slate-500">
            Admin seed user: <span className="font-mono">sridhar.voleti@gmail.com</span> / <span className="font-mono">admin123</span>
          </div>
        </div>
      </div>
    </div>
  )
}
