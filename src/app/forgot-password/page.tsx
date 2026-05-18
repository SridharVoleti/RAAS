'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const { t } = useLang()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (err) setError(err.message)
      else setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">ॐ</div>
          <h1 className="text-brand-gold font-bold text-2xl">Krishnamargam</h1>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
          {sent ? (
            <div className="text-center">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="text-brand-gold font-bold text-xl mb-2">Check your inbox</h2>
              <p className="text-brand-body text-sm mb-2">We sent a password reset link to:</p>
              <p className="text-brand-gold font-semibold mb-4">{email}</p>
              <p className="text-brand-gold-muted text-xs mb-5">The link expires in 30 minutes.</p>
              <button
                onClick={handleReset}
                className="text-brand-gold-muted text-sm hover:text-brand-gold transition-colors underline block mx-auto mb-4"
              >
                Resend link
              </button>
              <Link href="/login" className="text-brand-gold text-sm hover:underline">
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-brand-gold font-bold text-xl mb-2">Forgot Password</h2>
              <p className="text-brand-gold-muted text-sm mb-6">Enter your email and we'll send a reset link.</p>

              {error && (
                <div className="mb-4 p-3 bg-brand-error/10 border border-brand-error/30 rounded-lg text-brand-error text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-brand-body text-sm font-medium mb-1.5">{t.auth.email}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-70"
                >
                  {loading ? '...' : t.auth.sendResetLink}
                </button>
              </form>
              <p className="text-center text-brand-gold-muted text-sm mt-5">
                <Link href="/login" className="text-brand-gold hover:underline">← {t.auth.signIn}</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
