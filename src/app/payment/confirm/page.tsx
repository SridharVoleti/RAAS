'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLang } from '@/contexts/LanguageContext'
import { COURSES } from '@/lib/courseData'

function ConfirmContent() {
  const { t } = useLang()
  const params = useSearchParams()
  const courseId = Number(params.get('courseId'))
  const istHour = Number(params.get('istHour') || '12')
  const isAfter11PM = istHour >= 23

  const course = COURSES.find(c => c.id === courseId)
  const conf = isAfter11PM ? t.confirmation.pending : t.confirmation.instant

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
        <div className="text-6xl mb-4">{conf.icon}</div>
        <h2 className="text-brand-gold font-bold text-2xl mb-2">{conf.title}</h2>

        {!isAfter11PM && (
          <p className="text-brand-body text-sm mb-3">
            Payment received for <span className="text-brand-gold font-semibold">{course?.title_en}</span>. {(conf as typeof t.confirmation.instant).subtitle}
          </p>
        )}
        {isAfter11PM && (
          <p className="text-brand-body text-sm mb-3">
            Thank you for enrolling in <span className="text-brand-gold font-semibold">{course?.title_en}</span>. Your payment has been recorded.
          </p>
        )}

        <div className={`p-4 rounded-xl mb-6 text-sm ${isAfter11PM ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-300' : 'bg-brand-success/10 border border-brand-success/20 text-brand-success'}`}>
          {conf.note}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="flex-1 py-2.5 border border-brand-border text-brand-body rounded-lg hover:border-brand-gold hover:text-brand-gold transition-colors text-sm font-medium"
          >
            {t.confirmation.goHome}
          </Link>
          <Link
            href="/explore"
            className="flex-1 py-2.5 bg-brand-gold text-brand-bg rounded-lg hover:bg-yellow-400 transition-colors text-sm font-semibold"
          >
            {t.confirmation.exploreMore}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function PaymentConfirmPage() {
  return (
    <Suspense>
      <ConfirmContent />
    </Suspense>
  )
}
