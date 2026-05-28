'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Smartphone, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

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

function VerifyMobileForm() {
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = params.get('returnTo') || '/'
  const supabase = createClient()

  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(true)
  const [otp, setOtp] = useState('')
  const [otpSending, setOtpSending] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
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

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('mobile, mobile_verified')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.mobile_verified) { router.push(returnTo); return }
      if (profile?.mobile) setMobile(profile.mobile)
      setLoading(false)
    }
    init()
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function sendOtp() {
    if (!mobile) return
    setOtpSending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/send-mobile-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Could not send OTP')
      } else {
        setOtpSent(true)
        startCountdown()
      }
    } finally {
      setOtpSending(false)
    }
  }

  async function handleVerify() {
    if (otp.length < 6) { setError('Enter all 6 digits'); return }
    setError('')
    setVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-mobile-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp }),
      })
      const data = await res.json()
      if (res.ok && data.verified) {
        setVerified(true)
        setTimeout(() => router.push(returnTo), 1500)
      } else {
        setError(data.error ?? 'Verification failed')
      }
    } finally {
      setVerifying(false)
    }
  }

  const maskedMobile = mobile.replace(/(\+\d{1,3})(\d{2})\d+(\d{2})$/, '$1 $2****$3')

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-brand-gold animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-brand-gold/20 flex items-center justify-center mx-auto mb-4">
            <Smartphone className="w-8 h-8 text-brand-gold" />
          </div>
          <h1 className="text-brand-gold font-bold text-2xl">Verify Mobile</h1>
          <p className="text-brand-body text-sm mt-1">One last step to secure your account</p>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
          {verified ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
              <p className="text-green-400 font-semibold">Mobile Verified!</p>
              <p className="text-brand-gold-muted text-sm">Redirecting you…</p>
            </div>
          ) : !otpSent ? (
            <div className="space-y-4">
              <p className="text-brand-body text-sm text-center">
                We&apos;ll send a 6-digit OTP to <span className="text-brand-gold font-medium">{maskedMobile}</span>
              </p>
              {error && <p className="text-brand-error text-sm text-center">{error}</p>}
              <button
                onClick={sendOtp}
                disabled={otpSending}
                className="w-full py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {otpSending && <Loader2 className="w-4 h-4 animate-spin" />}
                {otpSending ? 'Sending…' : 'Send OTP'}
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-brand-body text-sm text-center">
                Enter the 6-digit code sent to <span className="text-brand-gold font-medium">{maskedMobile}</span>
              </p>

              <OtpBoxes value={otp} onChange={setOtp} />

              {error && <p className="text-brand-error text-xs text-center">{error}</p>}

              <button
                onClick={handleVerify}
                disabled={verifying || otp.length < 6}
                className="w-full py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
                {verifying ? 'Verifying…' : 'Verify'}
              </button>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-brand-gold-muted text-xs">Resend in {countdown}s</p>
                ) : (
                  <button onClick={sendOtp} className="text-brand-gold text-xs hover:underline">
                    Resend OTP
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyMobilePage() {
  return (
    <Suspense>
      <VerifyMobileForm />
    </Suspense>
  )
}
