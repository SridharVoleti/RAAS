'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Receipt, Download } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'

interface Invoice {
  id:            number
  courseTitle:   string
  amountUsd:     number
  status:        'pending' | 'confirmed' | 'rejected'
  createdAt:     string
  confirmedAt:   string | null
  receiptNumber: string | null
}

const CURRENT_YEAR = new Date().getFullYear()

export default function MyInvoicesPage() {
  const { lang, t } = useLang()
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [isInternational, setIsInternational] = useState<boolean | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?returnTo=/my-invoices'); return }

      const { data: profile } = await supabase.from('profiles').select('country').eq('id', user.id).single()
      setIsInternational((profile?.country ?? 'India') !== 'India')

      const res = await fetch('/api/my-invoices')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices ?? [])
      }
      setLoading(false)
    }
    load()
  // router is stable from Next.js
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function statusLabel(status: Invoice['status']): string {
    if (status === 'confirmed') return t.invoices.statusConfirmed
    if (status === 'rejected') return t.invoices.statusRejected
    return t.invoices.statusPending
  }

  function statusClasses(status: Invoice['status']): string {
    if (status === 'confirmed') return 'bg-green-500/10 text-green-400'
    if (status === 'rejected') return 'bg-red-500/10 text-red-400'
    return 'bg-brand-gold/10 text-brand-gold'
  }

  function canDownloadInvoice(inv: Invoice): boolean {
    if (inv.status !== 'confirmed') return false
    const year = new Date(inv.confirmedAt ?? inv.createdAt).getFullYear()
    return year === CURRENT_YEAR
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-4xl animate-pulse">ॐ</div>
      </div>
    )
  }

  if (isInternational === false) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <p className="text-brand-gold-muted text-sm text-center max-w-sm">{t.invoices.onlyForInternational}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-brand-gold font-bold text-2xl flex items-center gap-2">
            <Receipt className="w-6 h-6" />
            {t.invoices.pageTitle}
          </h1>
          <p className="text-brand-gold-muted text-sm mt-1">{t.invoices.pageSubtitle}</p>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🧾</div>
            <p className="text-brand-gold-muted text-sm mb-6">{t.invoices.empty}</p>
            <Link
              href="/explore"
              className="inline-block px-6 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm"
            >
              {t.invoices.exploreCourses}
            </Link>
          </div>
        ) : (
          <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead>
                  <tr className="text-brand-gold-muted text-xs uppercase font-medium border-b border-brand-border bg-brand-bg">
                    <th className="text-left px-5 py-3">{t.invoices.course}</th>
                    <th className="text-right px-5 py-3">{t.invoices.amount}</th>
                    <th className="text-left px-5 py-3">{t.invoices.status}</th>
                    <th className="text-right px-5 py-3">{t.invoices.date}</th>
                    <th className="text-right px-5 py-3">{t.invoices.invoice}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, i) => (
                    <tr key={inv.id}
                      className={`border-b border-brand-border last:border-0 ${i % 2 === 0 ? '' : 'bg-brand-bg/30'}`}>
                      <td className="px-5 py-3 text-brand-body font-medium">{inv.courseTitle}</td>
                      <td className="px-5 py-3 text-right font-semibold text-brand-gold">
                        ${Number(inv.amountUsd).toFixed(2)}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses(inv.status)}`}>
                          {statusLabel(inv.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-brand-gold-muted text-xs">
                        {new Date(inv.createdAt).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canDownloadInvoice(inv) ? (
                          <a
                            href={`/api/course-purchase/${inv.id}/receipt`}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-gold/10 text-brand-gold border border-brand-gold/30 text-xs font-semibold rounded-lg hover:bg-brand-gold/20 transition-colors ml-auto w-fit"
                          >
                            <Download className="w-3.5 h-3.5" /> {t.invoices.download}
                          </a>
                        ) : (
                          <span className="text-brand-gold-muted text-xs">{t.invoices.notYetAvailable}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
