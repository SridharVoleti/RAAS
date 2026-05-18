'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { getAvatarInitials } from '@/lib/utils'

const ISD_OPTIONS = ['+91', '+1', '+44', '+61', '+971', '+65']

function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score as 0 | 1 | 2 | 3 | 4
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']

export default function RegisterPage() {
  const { t } = useLang()
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [isd, setIsd] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const strength = getPasswordStrength(password)
  const pwMatch = confirmPw.length > 0 && password === confirmPw

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPw) { setError('Passwords do not match'); return }
    if (strength < 2) { setError('Please use a stronger password'); return }

    setError('')
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            mobile: `${isd}${mobile}`,
            avatar_initials: getAvatarInitials(fullName),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (err) {
        setError(err.message)
      } else {
        setSuccess(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">🪷</div>
          <h2 className="text-brand-gold font-bold text-xl mb-2">One last step!</h2>
          <p className="text-brand-body text-sm mb-1">We sent a confirmation email to:</p>
          <p className="text-brand-gold font-semibold mb-5">{email}</p>
          <div className="text-left space-y-2 mb-6">
            <p className="text-brand-gold-muted text-sm font-medium">What happens next:</p>
            <div className="space-y-1.5">
              {['Check your inbox', 'Click the confirmation link', 'Start your spiritual journey!'].map((step, i) => (
                <div key={i} className="flex items-center gap-2 text-brand-body text-sm">
                  <span className="w-5 h-5 rounded-full bg-brand-gold text-brand-bg text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  {step}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={handleRegister}
            className="text-brand-gold-muted text-sm hover:text-brand-gold transition-colors underline"
          >
            Resend email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">ॐ</div>
          <h1 className="text-brand-gold font-bold text-2xl">Krishnamargam</h1>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
          {/* Tab toggle */}
          <div className="flex bg-brand-bg rounded-lg border border-brand-border overflow-hidden mb-6">
            <Link href="/login" className="flex-1 py-2 text-center text-sm text-brand-gold-muted hover:text-brand-gold transition-colors">
              {t.auth.signIn}
            </Link>
            <div className="flex-1 py-2 text-center text-sm bg-brand-gold text-brand-bg font-semibold">
              {t.auth.register}
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-brand-error/10 border border-brand-error/30 rounded-lg text-brand-error text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">{t.auth.fullName}</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="Your full name"
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>

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
              <label className="block text-brand-body text-sm font-medium mb-1.5">{t.auth.mobile}</label>
              <div className="flex gap-2">
                <select
                  value={isd}
                  onChange={e => setIsd(e.target.value)}
                  className="px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm focus:outline-none focus:border-brand-gold"
                >
                  {ISD_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="9876543210"
                  className="flex-1 px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">{t.auth.password}</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 pr-10 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gold-muted hover:text-brand-gold">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength meter */}
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? STRENGTH_COLORS[strength] : 'bg-brand-border'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-brand-gold-muted">{STRENGTH_LABELS[strength]}</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">{t.auth.confirmPassword}</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                required
                placeholder="••••••••"
                className={`w-full px-4 py-2.5 bg-brand-bg border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none transition-colors ${
                  confirmPw.length > 0
                    ? pwMatch ? 'border-brand-success' : 'border-brand-error'
                    : 'border-brand-border focus:border-brand-gold'
                }`}
              />
              {confirmPw.length > 0 && (
                <p className={`text-xs mt-1 ${pwMatch ? 'text-brand-success' : 'text-brand-error'}`}>
                  {pwMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-70 mt-2"
            >
              {loading ? '...' : t.auth.register}
            </button>
          </form>

          <p className="text-center text-brand-gold-muted text-sm mt-5">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-gold hover:underline font-medium">{t.auth.signIn}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
