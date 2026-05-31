'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle2, Mail } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const { t } = useLang()
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = params.get('returnTo') || '/'
  const justRegistered = params.get('registered') === '1'
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError(t.auth.incorrectCredentials)
      } else {
        // Check if the student needs to complete their profile
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('profile_complete')
            .eq('id', user.id)
            .maybeSingle()

          if (!profile?.profile_complete) {
            router.push(`/onboarding?returnTo=${encodeURIComponent(returnTo)}`)
            return
          }
        }
        router.push(returnTo)
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">ॐ</div>
          <h1 className="text-brand-gold font-bold text-2xl">Krishnamargam</h1>
          <p className="text-brand-gold-muted text-sm mt-1">Your Spiritual Journey</p>
        </div>

        {/* Card */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
          <h2 className="text-brand-gold font-bold text-xl mb-6 text-center">{t.auth.signIn}</h2>

          {justRegistered && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                <p className="text-green-400 text-sm font-semibold">Account created successfully!</p>
              </div>
              <div className="flex items-start gap-2 mt-2">
                <Mail className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-brand-body text-xs leading-relaxed">
                  You can sign in now. Note: your email address has not been formally verified yet.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-brand-error/10 border border-brand-error/30 rounded-lg text-brand-error text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-brand-body text-sm font-medium">{t.auth.password}</label>
                <Link href="/forgot-password" className="text-brand-gold-muted text-xs hover:text-brand-gold transition-colors">
                  {t.auth.forgotPassword}
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gold-muted hover:text-brand-gold"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-70 mt-2"
            >
              {loading ? '...' : t.auth.signIn}
            </button>
          </form>

          <p className="text-center text-brand-gold-muted text-sm mt-5">
            {t.auth.newToRaas}{' '}
            <Link href="/register" className="text-brand-gold hover:underline font-medium">
              {t.auth.createAccount}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
