'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function passwordRequirements(pwd: string) {
  return {
    length: pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  }
}

function ResetPasswordForm() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Wait for Supabase to exchange the recovery hash token into a session.
  // Supabase only fires PASSWORD_RECOVERY when the browser had no prior
  // session; if the user was already signed in (e.g. via Google), it fires
  // SIGNED_IN/INITIAL_SESSION instead — so gate on the recovery link being
  // present in the URL rather than one specific event name.
  useEffect(() => {
    const isRecoveryLink = typeof window !== 'undefined' && window.location.hash.includes('type=recovery')

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (isRecoveryLink && session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        setSessionReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!sessionReady) {
      setError('Reset link is invalid or has expired. Please request a new one.')
      return
    }

    const reqs = passwordRequirements(password)
    if (!reqs.length) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!reqs.uppercase) {
      setError('Password must contain at least 1 uppercase letter.')
      return
    }
    if (!reqs.number) {
      setError('Password must contain at least 1 number.')
      return
    }
    if (!reqs.special) {
      setError('Password must contain at least 1 special character.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
      } else {
        setDone(true)
        setTimeout(() => router.push('/login'), 2500)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-10 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-brand-gold mb-2">Password Updated</h2>
          <p className="text-brand-body text-sm">Redirecting you to login…</p>
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
              placeholder="Min. 8 characters"
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-4 py-2.5 text-brand-body placeholder-brand-body/40 focus:outline-none focus:border-brand-gold"
            />
            {password.length > 0 && (() => {
              const reqs = passwordRequirements(password)
              const rules = [
                { key: 'length',    label: 'At least 8 characters',      met: reqs.length },
                { key: 'uppercase', label: 'At least 1 uppercase letter', met: reqs.uppercase },
                { key: 'number',    label: 'At least 1 number',           met: reqs.number },
                { key: 'special',   label: 'At least 1 special character',met: reqs.special },
              ]
              return (
                <ul className="mt-2 space-y-1">
                  {rules.map(r => (
                    <li key={r.key} className={`flex items-center gap-1.5 text-xs ${r.met ? 'text-green-500' : 'text-brand-body/60'}`}>
                      <span>{r.met ? '✓' : '○'}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              )
            })()}
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
