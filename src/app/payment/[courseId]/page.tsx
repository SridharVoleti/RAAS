'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Copy, Check } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { getCourseById, getCourseBySlug } from '@/lib/getCourses'
import { StateSelect } from '@/components/StateSelect'
import { FcraNotice } from '@/components/FcraNotice'
import { DonorDeclaration } from '@/components/DonorDeclaration'
import { OUTSIDE_INDIA } from '@/lib/indian-states'
import type { Course } from '@/types'

type IntlSettings = {
  intl_bank_account_holder?: string
  intl_bank_name?:           string
  intl_account_number?:      string
  intl_swift_bic?:           string
  intl_iban?:                string
  intl_qr_url?:              string
  intl_payment_instructions?: string
}

const PURCHASE_PRICE_USD = 25

export default function PaymentPage() {
  const { t } = useLang()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState<'pay' | 'scholarship' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Domestic (India) donate-style flow
  const [state, setState] = useState('')
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const isForeign = state === OUTSIDE_INDIA

  // Foreign-national purchase flow — a sale, not a donation, so FCRA doesn't apply.
  // Defaults to domestic until we know the signed-in student's profile country.
  const [studentCountry, setStudentCountry] = useState('India')
  const [intlSettings, setIntlSettings] = useState<IntlSettings>({})
  const [reference, setReference] = useState('')
  const [purchaseSubmitted, setPurchaseSubmitted] = useState(false)
  const [purchasing, setPurchasing] = useState(false)
  const [copied, setCopied] = useState(false)
  const isForeignStudent = studentCountry !== 'India'

  useEffect(() => {
    async function loadCourse() {
      const courseId = params.courseId
      if (!courseId) { router.push('/explore'); return }
      const isNumeric = /^\d+$/.test(String(courseId))
      const found = isNumeric
        ? await getCourseById(Number(courseId))
        : await getCourseBySlug(String(courseId))
      if (found) setCourse(found)
      else router.push('/explore')
    }
    loadCourse()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('country').eq('id', user.id).single()
      if (profile?.country) setStudentCountry(profile.country)
    })

    fetch('/api/public/settings')
      .then(r => r.json())
      .then((data: IntlSettings) => setIntlSettings(data))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.courseId, router])

  // TODO: Razorpay isn't configured yet — the domestic "Donate" and free options enroll directly for now.
  async function handleEnroll(source: 'pay' | 'scholarship') {
    if (!course) return
    // State + FCRA declaration only gate the domestic donation option — free access isn't a contribution.
    if (source === 'pay') {
      if (!state) { setError(t.payment.stateRequired); return }
      if (isForeign) { setError(t.payment.foreignBlocked); return }
      if (!declarationAccepted) { setError(t.payment.declarationRequired); return }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setLoading(source)
    setError(null)
    try {
      const res = await fetch('/api/enroll/scholarship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Enrollment failed')
        setLoading(null)
        return
      }
      router.push(`/watch/${course.slug}`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  async function handlePurchaseSubmit() {
    if (!course) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setPurchasing(true)
    setError(null)
    try {
      const res = await fetch('/api/course-purchase/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ courseId: course.id, reference: reference.trim() || undefined }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? t.payment.purchaseError)
        setPurchasing(false)
        return
      }
      setPurchaseSubmitted(true)
    } catch {
      setError(t.payment.purchaseError)
    }
    setPurchasing(false)
  }

  async function copyIntlAccount() {
    if (!intlSettings.intl_account_number) return
    await navigator.clipboard.writeText(intlSettings.intl_account_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!course) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-brand-gold text-4xl animate-pulse">ॐ</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">

          {/* Course summary */}
          <div className="p-5 border-b border-brand-border flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ backgroundColor: course.bg_color }}>
              {course.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-brand-gold font-semibold text-sm line-clamp-1">{course.title_en}</h3>
              <p className="text-brand-gold-muted text-xs">{course.instructor_en}</p>
            </div>
            <div className="text-brand-gold font-bold text-lg flex-shrink-0">
              {isForeignStudent ? `$${PURCHASE_PRICE_USD}` : `₹${course.price}`}
            </div>
          </div>

          <div className="p-6 space-y-3">
            <h2 className="text-brand-gold font-bold text-lg text-center mb-5">{t.payment.title}</h2>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {isForeignStudent ? (
              <>
                {/* Free access — no purchase, no gating */}
                <button
                  onClick={() => handleEnroll('scholarship')}
                  disabled={loading !== null}
                  className="w-full p-4 bg-brand-bg border border-brand-border rounded-xl text-left hover:border-brand-gold transition-colors disabled:opacity-60"
                >
                  <div className="text-brand-body font-semibold text-sm">{t.payment.optionCannotPay}</div>
                  {loading === 'scholarship' && <div className="text-brand-gold-muted text-xs mt-1">Loading…</div>}
                </button>

                {/* Purchase — a sale of course access, not a donation */}
                {purchaseSubmitted ? (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
                    {t.payment.purchaseSubmitted}
                  </div>
                ) : (
                  <div className="p-4 bg-brand-bg border border-brand-border rounded-xl space-y-3">
                    <p className="text-brand-gold font-semibold text-sm">{t.payment.purchaseTitle} — ${PURCHASE_PRICE_USD}</p>
                    <p className="text-brand-gold-muted text-xs">{t.payment.purchaseSubtitle}</p>

                    {intlSettings.intl_bank_account_holder && (
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="text-brand-gold-muted">Account Name</span>
                          <span className="text-brand-body">{intlSettings.intl_bank_account_holder}</span>
                        </div>
                        {intlSettings.intl_bank_name && (
                          <div className="flex justify-between">
                            <span className="text-brand-gold-muted">Bank</span>
                            <span className="text-brand-body">{intlSettings.intl_bank_name}</span>
                          </div>
                        )}
                        {intlSettings.intl_account_number && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-brand-gold-muted">Account / IBAN</span>
                            <span className="flex items-center gap-1.5">
                              <span className="text-brand-body font-mono">{intlSettings.intl_account_number}</span>
                              <button onClick={copyIntlAccount} className="text-brand-gold-muted hover:text-brand-gold transition-colors">
                                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </span>
                          </div>
                        )}
                        {intlSettings.intl_swift_bic && (
                          <div className="flex justify-between">
                            <span className="text-brand-gold-muted">SWIFT / BIC</span>
                            <span className="text-brand-body font-mono">{intlSettings.intl_swift_bic}</span>
                          </div>
                        )}
                        {intlSettings.intl_iban && (
                          <div className="flex justify-between">
                            <span className="text-brand-gold-muted">IBAN</span>
                            <span className="text-brand-body font-mono">{intlSettings.intl_iban}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {intlSettings.intl_qr_url && (
                      <div className="flex justify-center pt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={intlSettings.intl_qr_url} alt="Payment QR Code" className="w-32 h-32 rounded-lg border border-brand-border" />
                      </div>
                    )}

                    {intlSettings.intl_payment_instructions && (
                      <p className="text-brand-gold-muted text-xs">{intlSettings.intl_payment_instructions}</p>
                    )}

                    <input
                      type="text"
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      placeholder={t.payment.referencePlaceholder}
                      className="w-full px-3 py-2 bg-brand-card border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                    />

                    <button
                      onClick={handlePurchaseSubmit}
                      disabled={purchasing}
                      className="w-full py-2.5 bg-brand-gold text-brand-bg rounded-lg font-bold text-sm hover:bg-yellow-400 transition-colors disabled:opacity-60"
                    >
                      {purchasing ? t.payment.processing : t.payment.submitPurchase}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Option 1: Donate — state + FCRA declaration gate this option only */}
                <div className="space-y-3">
                  <StateSelect
                    value={state}
                    onChange={setState}
                    label={t.payment.stateLabel}
                    placeholder={t.payment.statePlaceholder}
                    outsideIndiaLabel={t.payment.outsideIndia}
                  />

                  {isForeign && <FcraNotice />}
                  {state && !isForeign && (
                    <DonorDeclaration checked={declarationAccepted} onChange={setDeclarationAccepted} />
                  )}

                  <button
                    onClick={() => handleEnroll('pay')}
                    disabled={loading !== null || !state || isForeign || !declarationAccepted}
                    className="w-full p-4 bg-brand-gold text-brand-bg rounded-xl text-left hover:bg-yellow-400 transition-colors disabled:opacity-60 group"
                  >
                    <div className="font-bold text-sm">{t.payment.optionPay}</div>
                    {loading === 'pay' && <div className="text-brand-bg/70 text-xs mt-1">Loading…</div>}
                  </button>
                </div>

                {/* Option 2: Free access — no donation, no state/declaration required */}
                <button
                  onClick={() => handleEnroll('scholarship')}
                  disabled={loading !== null}
                  className="w-full p-4 bg-brand-bg border border-brand-border rounded-xl text-left hover:border-brand-gold transition-colors disabled:opacity-60"
                >
                  <div className="text-brand-body font-semibold text-sm">{t.payment.optionCannotPay}</div>
                  {loading === 'scholarship' && <div className="text-brand-gold-muted text-xs mt-1">Loading…</div>}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
