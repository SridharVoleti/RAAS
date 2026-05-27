'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { getCourseById, getCourseBySlug } from '@/lib/getCourses'
import { getISTHour } from '@/lib/utils'
import type { Course } from '@/types'

const UPI_ID = 'raas@upi'

export default function PaymentPage() {
  const { t } = useLang()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [istHour] = useState(() => getISTHour())

  useEffect(() => {
    async function loadCourse() {
      const courseId = params.courseId
      if (!courseId) {
        router.push('/explore')
        return
      }

      // Try to fetch by slug first, then by ID
      const isNumeric = /^\d+$/.test(String(courseId))
      let found: Course | null = null

      if (!isNumeric) {
        found = await getCourseBySlug(String(courseId))
      } else {
        found = await getCourseById(Number(courseId))
      }

      if (found) {
        setCourse(found)
      } else {
        router.push('/explore')
      }
    }

    loadCourse()
  }, [params.courseId, router])

  async function handleCompletePayment() {
    if (!course) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, amount: course.price }),
      })
      if (res.ok) {
        router.push(`/payment/confirm?courseId=${course.id}&istHour=${istHour}`)
      }
    } finally {
      setLoading(false)
    }
  }

  async function copyUPI() {
    await navigator.clipboard.writeText(UPI_ID)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!course) return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-brand-gold text-4xl animate-pulse">ॐ</div>
    </div>
  )

  const isAfter11PM = istHour >= 23

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-brand-card border border-brand-border rounded-2xl overflow-hidden">
          {/* Course summary */}
          <div className="p-5 border-b border-brand-border flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0" style={{ backgroundColor: course.bg_color }}>
              {course.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-brand-gold font-semibold text-sm line-clamp-1">{course.title_en}</h3>
              <p className="text-brand-gold-muted text-xs">{course.instructor_en}</p>
            </div>
            <div className="text-brand-gold font-bold text-lg flex-shrink-0">₹{course.price}</div>
          </div>

          <div className="p-6">
            <h2 className="text-brand-gold font-bold text-xl mb-6 text-center">{t.payment.title}</h2>

            {/* QR Code placeholder */}
            <div className="bg-white rounded-xl p-4 mb-5 flex items-center justify-center">
              <div className="text-center">
                <div className="w-48 h-48 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-2 border-2 border-dashed border-gray-300">
                  <div className="text-gray-400 text-sm text-center px-4">
                    <div className="text-3xl mb-2">📱</div>
                    <p>Scan with any UPI app</p>
                    <p className="text-xs mt-1">Google Pay · PhonePe · Paytm</p>
                  </div>
                </div>
                <p className="text-gray-500 text-xs">QR code connects to Razorpay</p>
              </div>
            </div>

            {/* UPI ID */}
            <div className="flex items-center justify-between p-3 bg-brand-bg border border-brand-border rounded-lg mb-4">
              <div>
                <p className="text-brand-gold-muted text-xs">{t.payment.upiId}</p>
                <p className="text-brand-body font-semibold">{UPI_ID}</p>
              </div>
              <button
                onClick={copyUPI}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-border rounded-lg text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold transition-colors text-sm"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? t.payment.copied : t.payment.copy}
              </button>
            </div>

            {/* Time notice */}
            <div className={`p-3 rounded-lg mb-5 text-sm border ${isAfter11PM ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300' : 'bg-brand-success/10 border-brand-success/30 text-brand-success'}`}>
              {isAfter11PM ? t.payment.afterElevenPm : t.payment.beforeElevenPm}
            </div>

            <button
              onClick={handleCompletePayment}
              disabled={loading}
              className="w-full py-3 bg-brand-gold text-brand-bg font-bold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-70"
            >
              {loading ? '...' : t.payment.completedPayment}
            </button>

            <Link href={`/course/${course.slug}`} className="block text-center text-brand-gold-muted text-sm mt-4 hover:text-brand-gold transition-colors">
              {t.payment.backToCourse}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
