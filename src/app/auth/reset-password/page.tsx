'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // Supabase sends the token via URL hash; exchanged automatically on mount
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {})
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setDone(true)
      setTimeout(() => router.push('/my-courses'), 2500)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-10 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-brand-gold mb-2">Password Updated</h2>
          <p className="text-brand-body text-sm">Redirecting you to your courses…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <span className="text-brand-gold text-4xl font-serif">ॐ</span>
          <h1 className="text-xl font-bold text-brand-gold mt-2">Set New Password</h1>
          <p className="text-brand-body text-sm mt-1">Choose a strong password for your account.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-brand-error/10 border border-brand-error/30 text-brand-error text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-brand-body text-sm mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 characters"
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-body placeholder-brand-body/40 focus:outline-none focus:border-brand-gold"
            />
          </div>
          <div>
            <label className="block text-brand-body text-sm mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="Repeat password"
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-body placeholder-brand-body/40 focus:outline-none focus:border-brand-gold"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-gold text-brand-bg font-semibold py-3 rounded-lg hover:bg-brand-gold-secondary transition-colors disabled:opacity-60"
          >
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <span className="text-brand-gold text-4xl animate-pulse font-serif">ॐ</span>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
