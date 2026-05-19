'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'

const ISD_OPTIONS = ['+91', '+1', '+44', '+61', '+971', '+65', '+60', '+94', '+977', '+880']

const COUNTRIES = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'UAE', 'Singapore', 'Germany', 'Netherlands', 'Malaysia',
  'Sri Lanka', 'Nepal', 'Bangladesh', 'New Zealand', 'Other',
]

function mobileDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function isValidMobile(digits: string): boolean {
  return digits.length >= 7 && digits.length <= 15
}

function OnboardingForm() {
  const { t } = useLang()
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = params.get('returnTo') || '/'
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const [isd, setIsd] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('India')

  const [touched, setTouched] = useState({ mobile: false, city: false })

  const mobileNum = mobileDigits(mobile)
  const mobileValid = isValidMobile(mobileNum)
  const cityValid = city.trim().length > 0

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace(`/login?returnTo=/onboarding?returnTo=${encodeURIComponent(returnTo)}`)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('mobile, isd_code, city, country, profile_complete')
        .eq('id', user.id)
        .single()

      // Already complete — skip onboarding
      if (profile?.profile_complete) {
        router.replace(returnTo.startsWith('/') ? returnTo : '/')
        return
      }

      setUserId(user.id)

      // Pre-fill from profile (email-register users may have mobile in metadata)
      if (profile?.mobile) {
        // Attempt to split stored "+91xxxxxxxxxx" into isd + digits
        const stored = profile.mobile
        const knownISD = ISD_OPTIONS.find(c => stored.startsWith(c))
        if (knownISD) {
          setIsd(knownISD)
          setMobile(stored.slice(knownISD.length))
        } else {
          setMobile(stored.replace(/^\+?\d{1,3}/, ''))
        }
      } else {
        // Try to get mobile from user metadata (set during email registration)
        const meta = user.user_metadata?.mobile as string | undefined
        if (meta) {
          const knownISD = ISD_OPTIONS.find(c => meta.startsWith(c))
          if (knownISD) {
            setIsd(knownISD)
            setMobile(meta.slice(knownISD.length))
          }
        }
      }

      if (profile?.city) setCity(profile.city)
      if (profile?.country) setCountry(profile.country)

      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ mobile: true, city: true })
    if (!mobileValid || !cityValid) return

    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase.from('profiles').update({
        mobile: mobileNum,
        isd_code: isd,
        city: city.trim(),
        country,
        profile_complete: true,
        updated_at: new Date().toISOString(),
      }).eq('id', userId!)

      if (err) {
        setError(err.message)
      } else {
        router.push(returnTo.startsWith('/') ? returnTo : '/')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-5xl animate-pulse">ॐ</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">ॐ</div>
          <h1 className="text-brand-gold font-bold text-2xl">Krishnamargam</h1>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg font-bold text-sm flex-shrink-0">
              1
            </div>
            <div>
              <p className="text-brand-gold font-semibold text-base">{t.onboarding.title}</p>
              <p className="text-brand-gold-muted text-xs">{t.onboarding.subtitle}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-brand-error/10 border border-brand-error/30 rounded-lg text-brand-error text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Mobile */}
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">
                {t.onboarding.mobile}
                <span className="text-brand-error ml-1">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={isd}
                  onChange={e => setIsd(e.target.value)}
                  className="px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm focus:outline-none focus:border-brand-gold transition-colors w-24"
                >
                  {ISD_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <div className="flex-1">
                  <input
                    type="tel"
                    value={mobile}
                    onChange={e => setMobile(e.target.value)}
                    onBlur={() => setTouched(p => ({ ...p, mobile: true }))}
                    placeholder={t.onboarding.mobilePlaceholder}
                    className={`w-full px-4 py-2.5 bg-brand-bg border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none transition-colors ${
                      touched.mobile && !mobileValid
                        ? 'border-brand-error focus:border-brand-error'
                        : 'border-brand-border focus:border-brand-gold'
                    }`}
                  />
                </div>
              </div>
              {touched.mobile && !mobileValid && (
                <p className="text-brand-error text-xs mt-1">{t.onboarding.invalidMobile}</p>
              )}
            </div>

            {/* City */}
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">
                {t.onboarding.city}
                <span className="text-brand-error ml-1">*</span>
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                onBlur={() => setTouched(p => ({ ...p, city: true }))}
                placeholder={t.onboarding.cityPlaceholder}
                className={`w-full px-4 py-2.5 bg-brand-bg border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none transition-colors ${
                  touched.city && !cityValid
                    ? 'border-brand-error focus:border-brand-error'
                    : 'border-brand-border focus:border-brand-gold'
                }`}
              />
              {touched.city && !cityValid && (
                <p className="text-brand-error text-xs mt-1">{t.onboarding.requiredCity}</p>
              )}
            </div>

            {/* Country */}
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">
                {t.onboarding.country}
                <span className="text-brand-error ml-1">*</span>
              </label>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body focus:outline-none focus:border-brand-gold transition-colors"
              >
                {COUNTRIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <p className="text-brand-gold-muted text-xs leading-relaxed">{t.onboarding.note}</p>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-70 mt-1"
            >
              {saving ? t.onboarding.submitting : t.onboarding.submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-5xl animate-pulse">ॐ</div>
      </div>
    }>
      <OnboardingForm />
    </Suspense>
  )
}
