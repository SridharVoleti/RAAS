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

type BankSettings = {
  bank_upi_id?:         string
  bank_account_holder?: string
  bank_name?:           string
  bank_account_number?: string
  bank_ifsc?:           string
  bank_qr_url?:         string
}

export default function DonatePage() {
  const { t } = useLang()
  const router = useRouter()

  const [bank, setBank]               = useState<BankSettings>({})
  const [state, setState]             = useState('')
  const [declarationAccepted, setDeclarationAccepted] = useState(false)
  const [copied, setCopied]           = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login?returnTo=/donate'); return }
    })

    fetch('/api/public/settings')
      .then(r => r.json())
      .then((data: BankSettings) => setBank(data))
      .catch(() => {})
  }, [router])

  const isForeign = state === OUTSIDE_INDIA

  async function copyUpi() {
    if (!bank.bank_upi_id) return
    await navigator.clipboard.writeText(bank.bank_upi_id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const hasBank = bank.bank_upi_id || bank.bank_account_number

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-4">

        {/* Header card */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 text-center">
          <Heart className="w-10 h-10 text-brand-gold mx-auto mb-3" />
          <h1 className="text-brand-gold font-bold text-xl">{t.donate.title}</h1>
          <p className="text-brand-gold-muted text-sm mt-2">{t.donate.subtitle}</p>
        </div>

        {/* State check — gates FCRA eligibility before showing bank/QR details */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 space-y-4">
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
        </div>

        {/* Bank details card — Indian donations only; foreign contributions are FCRA-blocked above */}
        {hasBank && state && !isForeign && (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 space-y-3">
            <p className="text-brand-gold text-sm font-semibold border-b border-brand-border pb-2">
              Donate directly via bank / UPI
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
              <div className="flex flex-col items-center gap-2 pt-1">
                <p className="text-brand-gold-muted text-xs font-medium">Temporary Account</p>
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
