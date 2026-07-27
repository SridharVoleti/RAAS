'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, Copy, Check } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { StateSelect } from '@/components/StateSelect'
import { FcraNotice } from '@/components/FcraNotice'
import { DonorDeclaration } from '@/components/DonorDeclaration'
import { OUTSIDE_INDIA } from '@/lib/indian-states'

import type { RazorpayOptions } from '@/types'

async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.Razorpay) return true
  return new Promise(resolve => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload  = () => resolve(true)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

type BankSettings = {
  bank_upi_id?:         string
  bank_account_holder?: string
  bank_name?:           string
  bank_account_number?: string
  bank_ifsc?:           string
  bank_qr_url?:         string
}

const PRESETS = [50, 100, 500, 1000]

export default function DonatePage() {
  const { t } = useLang()
  const router = useRouter()

  const [userEmail, setUserEmail]     = useState<string | null>(null)
  const [userId, setUserId]           = useState<string | null>(null)
  const [bank, setBank]               = useState<BankSettings>({})
  const [customAmount, setCustomAmount] = useState('')
  const [selected, setSelected]       = useState<number | null>(100)
  const [state, setState]             = useState('')
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [copied, setCopied]           = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login?returnTo=/donate'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? null)
    })

    fetch('/api/public/settings')
      .then(r => r.json())
      .then((data: BankSettings) => setBank(data))
      .catch(() => {})
  }, [router])

  const amount = customAmount.trim() !== '' ? parseInt(customAmount, 10) : (selected ?? 0)
  const isForeign = state === OUTSIDE_INDIA

  async function handleDonate() {
    if (!userId) return
    if (!amount || amount < 10) { setError(t.donate.minAmount); return }
    if (!state) { setError(t.donate.stateRequired); return }
    if (isForeign) { setError(t.donate.foreignBlocked); return }
    if (!declarationAccepted) { setError(t.donate.declarationRequired); return }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/donate/initiate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount, purpose: 'general', state, declarationAccepted }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? t.donate.errorGeneric)
        setLoading(false)
        return
      }
      const { razorpayOrderId, razorpayKeyId, amount: amountPaise } = await res.json() as {
        razorpayOrderId: string; razorpayKeyId: string; amount: number
      }

      const loaded = await loadRazorpayScript()
      if (!loaded) { setError(t.donate.errorGeneric); setLoading(false); return }

      const rzp = new window.Razorpay({
        key:         razorpayKeyId,
        amount:      amountPaise,
        currency:    'INR',
        name:        'Krishnamargam',
        description: 'Donation – Platform Support',
        order_id:    razorpayOrderId,
        handler:     () => { setDone(true); setLoading(false) },
        prefill:     { email: userEmail ?? undefined },
        theme:       { color: '#f0b429' },
        modal:       { ondismiss: () => setLoading(false) },
      })
      rzp.open()
    } catch {
      setError(t.donate.errorGeneric)
      setLoading(false)
    }
  }

  async function copyUpi() {
    if (!bank.bank_upi_id) return
    await navigator.clipboard.writeText(bank.bank_upi_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasBank = bank.bank_upi_id || bank.bank_account_number

  if (done) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h2 className="text-brand-gold font-bold text-2xl mb-2">{t.donate.thankYou}</h2>
          <p className="text-brand-body text-sm">{t.donate.receiptNote}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-8 px-6 py-2.5 bg-brand-gold text-brand-bg rounded-lg font-semibold text-sm hover:bg-yellow-400 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-4">

        {/* Header card */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 text-center">
          <Heart className="w-10 h-10 text-brand-gold mx-auto mb-3" />
          <h1 className="text-brand-gold font-bold text-xl">{t.donate.title}</h1>
          <p className="text-brand-gold-muted text-sm mt-2">{t.donate.subtitle}</p>
        </div>

        {/* Amount selector */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 space-y-4">
          <p className="text-brand-body text-sm font-medium">{t.donate.amountLabel}</p>

          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map(p => (
              <button
                key={p}
                onClick={() => { setSelected(p); setCustomAmount('') }}
                className={`py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  selected === p && !customAmount
                    ? 'bg-brand-gold text-brand-bg border-brand-gold'
                    : 'bg-brand-bg border-brand-border text-brand-gold hover:border-brand-gold'
                }`}
              >
                ₹{p}
              </button>
            ))}
          </div>

          <input
            type="number"
            min={10}
            value={customAmount}
            onChange={e => { setCustomAmount(e.target.value); setSelected(null) }}
            placeholder={t.donate.customPlaceholder}
            className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
          />

          <StateSelect
            value={state}
            onChange={setState}
            label={t.donate.stateLabel}
            placeholder={t.donate.statePlaceholder}
            outsideIndiaLabel={t.donate.outsideIndia}
          />

          {isForeign && <FcraNotice />}
          {state && !isForeign && (
            <DonorDeclaration checked={declarationAccepted} onChange={setDeclarationAccepted} />
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleDonate}
            disabled={loading || !amount || amount < 10 || !state || isForeign || !declarationAccepted}
            className="w-full py-3 bg-brand-gold text-brand-bg rounded-xl font-bold text-sm hover:bg-yellow-400 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Heart className="w-4 h-4" />
            {loading ? t.donate.processing : `${t.donate.button} — ₹${amount || 0}`}
          </button>
        </div>

        {/* Bank details card */}
        {hasBank && (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 space-y-3">
            <p className="text-brand-gold text-sm font-semibold border-b border-brand-border pb-2">
              Or donate directly via bank / UPI
            </p>

            {bank.bank_upi_id && (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-brand-gold-muted text-xs">UPI ID</p>
                  <p className="text-brand-body font-mono text-sm">{bank.bank_upi_id}</p>
                </div>
                <button
                  onClick={copyUpi}
                  className="p-2 rounded-lg border border-brand-border text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            )}

            {bank.bank_qr_url && (
              <div className="flex justify-center pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bank.bank_qr_url} alt="UPI QR Code" className="w-36 h-36 rounded-lg border border-brand-border" />
              </div>
            )}

            {bank.bank_account_number && (
              <div className="space-y-1.5 pt-1 text-sm">
                {bank.bank_account_holder && (
                  <div className="flex justify-between">
                    <span className="text-brand-gold-muted">Account Name</span>
                    <span className="text-brand-body">{bank.bank_account_holder}</span>
                  </div>
                )}
                {bank.bank_name && (
                  <div className="flex justify-between">
                    <span className="text-brand-gold-muted">Bank</span>
                    <span className="text-brand-body">{bank.bank_name}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-brand-gold-muted">Account No.</span>
                  <span className="text-brand-body font-mono">{bank.bank_account_number}</span>
                </div>
                {bank.bank_ifsc && (
                  <div className="flex justify-between">
                    <span className="text-brand-gold-muted">IFSC</span>
                    <span className="text-brand-body font-mono">{bank.bank_ifsc}</span>
                  </div>
                )}
              </div>
            )}

            <p className="text-brand-gold-muted text-xs pt-1">
              After transferring, email us at support@srikrishnamargam.in with your name and transaction ID so we can send you a receipt.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
