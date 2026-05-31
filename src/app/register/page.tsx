'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Mail, Smartphone } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { getAvatarInitials } from '@/lib/utils'

const ISD_OPTIONS = ['+91', '+1', '+44', '+61', '+971', '+65']

const REFERRAL_OPTIONS = [
  { value: '', label: 'Select an option…' },
  { value: 'social_media', label: 'Social Media (Facebook / Instagram)' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'friend_family', label: 'Friend or Family' },
  { value: 'google_search', label: 'Google Search' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'temple', label: 'Temple / Religious Organisation' },
  { value: 'newspaper', label: 'Newspaper / Magazine' },
  { value: 'other', label: 'Other' },
]

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
const STRENGTH_TEXT_COLORS = ['', 'text-red-400', 'text-yellow-400', 'text-blue-400', 'text-green-400']

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

// ─── OTP Input ─────────────────────────────────────────────────────────────

function OtpBoxes({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus()
  }

  function handleChange(i: number, ch: string) {
    const digit = ch.replace(/\D/g, '').slice(-1)
    const arr = (value + '      ').slice(0, 6).split('')
    arr[i] = digit
    onChange(arr.join('').trimEnd())
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }

  function handlePaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (digits) { onChange(digits); refs.current[Math.min(digits.length, 5)]?.focus() }
    e.preventDefault()
  }

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          className="w-10 h-12 text-center text-lg font-bold bg-brand-bg border-2 border-brand-border rounded-lg text-brand-gold focus:outline-none focus:border-brand-gold transition-colors"
        />
      ))}
    </div>
  )
}

// ─── Success / Verify screen ────────────────────────────────────────────────

function VerifyScreen({ email, fullMobile }: { email: string; fullMobile: string }) {
  const router = useRouter()
  const [otp, setOtp] = useState('')
  const [otpSending, setOtpSending] = useState(true)
  const [otpError, setOtpError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [mobileVerified, setMobileVerified] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function startCountdown() {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setCountdown(60)
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current!); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function sendOtp() {
    setOtpSending(true)
    setOtpError('')
    try {
      const res = await fetch('/api/auth/send-mobile-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: fullMobile }),
      })
      if (!res.ok) {
        const data = await res.json()
        setOtpError(data.error ?? 'Could not send OTP')
      } else {
        startCountdown()
      }
    } finally {
      setOtpSending(false)
    }
  }

  useEffect(() => {
    sendOtp()
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleVerify() {
    if (otp.length < 6) { setOtpError('Enter all 6 digits'); return }
    setOtpError('')
    setVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-mobile-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile: fullMobile, otp }),
      })
      const data = await res.json()
      if (res.ok && data.verified) {
        setMobileVerified(true)
      } else {
        setOtpError(data.error ?? 'Verification failed')
      }
    } finally {
      setVerifying(false)
    }
  }

  // Mask mobile: show ISD + first 2 + **** + last 2
  const maskedMobile = fullMobile.replace(/(\+\d{1,3})(\d{2})\d+(\d{2})$/, '$1 $2****$3')

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🪷</div>
          <h1 className="text-brand-gold font-bold text-2xl">Almost there!</h1>
          <p className="text-brand-body text-sm mt-1">Complete both steps to activate your account</p>
        </div>

        <div className="space-y-4">

          {/* Step 1 – Email */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-brand-gold" />
              </div>
              <div>
                <p className="text-brand-gold font-semibold text-sm">Step 1 — Confirm your email</p>
                <p className="text-brand-gold-muted text-xs">{email}</p>
              </div>
            </div>
            <p className="text-brand-body text-sm leading-relaxed">
              We&apos;ve sent a confirmation link to your inbox. Click it to verify your email address.
            </p>
            <div className="mt-3 flex items-center gap-2 text-brand-gold-muted text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
              Waiting for confirmation
            </div>
          </div>

          {/* Step 2 – Mobile OTP */}
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${mobileVerified ? 'bg-green-500/20' : 'bg-brand-gold/20'}`}>
                <Smartphone className={`w-4 h-4 ${mobileVerified ? 'text-green-400' : 'text-brand-gold'}`} />
              </div>
              <div>
                <p className="text-brand-gold font-semibold text-sm">Step 2 — Verify your mobile</p>
                <p className="text-brand-gold-muted text-xs">{maskedMobile}</p>
              </div>
              {mobileVerified && <CheckCircle2 className="w-5 h-5 text-green-400 ml-auto" />}
            </div>

            {mobileVerified ? (
              <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Mobile number verified!
              </div>
            ) : (
              <>
                {otpSending ? (
                  <div className="flex items-center gap-2 text-brand-gold-muted text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending OTP…
                  </div>
                ) : (
                  <>
                    <p className="text-brand-body text-sm mb-4">
                      Enter the 6-digit OTP sent via SMS
                    </p>

                    <OtpBoxes value={otp} onChange={setOtp} />

                    {otpError && (
                      <p className="text-brand-error text-xs text-center mt-2">{otpError}</p>
                    )}

                    <button
                      onClick={handleVerify}
                      disabled={verifying || otp.length < 6}
                      className="w-full mt-4 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                      {verifying ? 'Verifying…' : 'Verify Mobile'}
                    </button>

                    <div className="mt-3 text-center">
                      {countdown > 0 ? (
                        <p className="text-brand-gold-muted text-xs">Resend in {countdown}s</p>
                      ) : (
                        <button
                          onClick={sendOtp}
                          className="text-brand-gold text-xs hover:underline"
                        >
                          Resend OTP
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {mobileVerified && (
            <div className="bg-brand-card border border-green-500/30 rounded-2xl p-4 text-center">
              <p className="text-brand-body text-sm mb-3">
                Mobile verified! Now click the email confirmation link to complete sign-up.
              </p>
              <Link href="/login" className="text-brand-gold font-medium text-sm hover:underline">
                Go to Sign In
              </Link>
            </div>
          )}

          {!mobileVerified && (
            <p className="text-center text-brand-gold-muted text-xs">
              Already confirmed?{' '}
              <Link href="/login" className="text-brand-gold hover:underline">Sign In</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Registration Form ──────────────────────────────────────────────────────

export default function RegisterPage() {
  const { t } = useLang()
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [fathersName, setFathersName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [isd, setIsd] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [referralSource, setReferralSource] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)

  const strength = getPasswordStrength(password)
  const pwMatch = confirmPw.length > 0 && password === confirmPw
  const fullMobile = `${isd}${mobile}`

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const checkUsername = useCallback((value: string) => {
    clearTimeout(debounceRef.current)
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    setUsername(cleaned)
    if (cleaned.length < 3) { setUsernameStatus(cleaned.length === 0 ? 'idle' : 'invalid'); return }
    setUsernameStatus('checking')
    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc('check_username_available', { uname: cleaned })
      if (error) {
        // RPC unavailable — allow submission; DB unique index is the backstop
        setUsernameStatus('idle')
      } else {
        setUsernameStatus(data === true ? 'available' : 'taken')
      }
    }, 500)
  }, [supabase])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmPw) { setError('Passwords do not match'); return }
    if (strength < 2) { setError('Please use a stronger password'); return }
    if (username.length < 3) { setError('Username must be at least 3 characters'); return }
    if (usernameStatus === 'taken') { setError('That username is already taken'); return }
    if (!referralSource) { setError('Please tell us how you heard about us'); return }

    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          fathersName,
          username,
          address,
          city,
          mobile: fullMobile,
          avatarInitials: getAvatarInitials(fullName),
          referralSource,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Registration failed. Please try again.')
      } else {
        router.push('/login?registered=1')
      }
    } finally {
      setLoading(false)
    }
  }

  if (registered) {
    return <VerifyScreen email={email} fullMobile={fullMobile} />
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">ॐ</div>
          <h1 className="text-brand-gold font-bold text-2xl">Krishnamargam</h1>
          <p className="text-brand-gold-muted text-sm mt-1">Create your account</p>
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

            {/* Email */}
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

            {/* Username */}
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">
                Username <span className="text-brand-gold-muted font-normal text-xs">(letters, numbers, _ and . only)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={e => checkUsername(e.target.value)}
                  required
                  minLength={3}
                  placeholder="your_username"
                  className={`w-full px-4 py-2.5 pr-10 bg-brand-bg border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none transition-colors ${
                    usernameStatus === 'available' ? 'border-green-500' :
                    usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-brand-error' :
                    'border-brand-border focus:border-brand-gold'
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-brand-gold-muted animate-spin" />}
                  {usernameStatus === 'available' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {usernameStatus === 'taken' && <XCircle className="w-4 h-4 text-brand-error" />}
                </span>
              </div>
              {usernameStatus === 'available' && <p className="text-xs mt-1 text-green-400">Username is available</p>}
              {usernameStatus === 'taken' && <p className="text-xs mt-1 text-brand-error">Username is already taken</p>}
              {usernameStatus === 'invalid' && <p className="text-xs mt-1 text-brand-error">At least 3 characters required</p>}
            </div>

            {/* Full Name + Father's Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className="block text-brand-body text-sm font-medium mb-1.5">Father&apos;s Name</label>
                <input
                  type="text"
                  value={fathersName}
                  onChange={e => setFathersName(e.target.value)}
                  required
                  placeholder="Father's full name"
                  className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">Address</label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                required
                placeholder="House no., Street, Area"
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>

            {/* City + Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-brand-body text-sm font-medium mb-1.5">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  required
                  placeholder="Your city"
                  className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-brand-body text-sm font-medium mb-1.5">{t.auth.mobile} / WhatsApp</label>
                <div className="flex gap-2">
                  <select
                    value={isd}
                    onChange={e => setIsd(e.target.value)}
                    className="px-2 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm focus:outline-none focus:border-brand-gold"
                  >
                    {ISD_OPTIONS.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    required
                    placeholder="9876543210"
                    className="flex-1 min-w-0 px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Password */}
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
              {password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? STRENGTH_COLORS[strength] : 'bg-brand-border'}`} />
                    ))}
                  </div>
                  <p className={`text-xs ${STRENGTH_TEXT_COLORS[strength]}`}>{STRENGTH_LABELS[strength]}</p>
                  <p className="text-xs text-brand-gold-muted mt-0.5">Use 8+ chars with uppercase, numbers &amp; symbols</p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
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
                    ? pwMatch ? 'border-green-500' : 'border-brand-error'
                    : 'border-brand-border focus:border-brand-gold'
                }`}
              />
              {confirmPw.length > 0 && (
                <p className={`text-xs mt-1 ${pwMatch ? 'text-green-400' : 'text-brand-error'}`}>
                  {pwMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            {/* Referral source */}
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">How did you hear about us?</label>
              <select
                value={referralSource}
                onChange={e => setReferralSource(e.target.value)}
                required
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body focus:outline-none focus:border-brand-gold transition-colors"
              >
                {REFERRAL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} disabled={o.value === ''}>{o.label}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading || usernameStatus === 'taken' || usernameStatus === 'checking'}
              className="w-full py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-70 mt-2"
            >
              {loading ? 'Creating account…' : 'Create Account'}
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
