'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { getCourseById, getCourseBySlug } from '@/lib/getCourses'
import { getISTHour } from '@/lib/utils'
import type { Course } from '@/types'

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void }
  }
}

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string }) => void
  prefill?: { email?: string }
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
}

async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.Razorpay) return true
  return new Promise(resolve => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.head.appendChild(script)
  })
}

export default function PaymentPage() {
  const { t } = useLang()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [istHour] = useState(() => getISTHour())

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
  }, [params.courseId, router])

  async function handleCompletePayment() {
    if (!course) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setLoading(true)
    setError(null)
    try {
      // Create Razorpay order on the backend
      const res = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course.id, amount: course.price }),
      })

      if (!res.ok) {
        const body = await res.json() as { error?: string }
        setError(body.error ?? 'Payment initiation failed')
        return
      }

      const { razorpayOrderId, razorpayKeyId, amount } = await res.json() as {
        razorpayOrderId: string
        razorpayKeyId: string
        amount: number
      }

      const loaded = await loadRazorpayScript()
      if (!loaded) { setError('Failed to load payment gateway. Please try again.'); return }

      const rzp = new window.Razorpay({
        key:         razorpayKeyId,
        amount,
        currency:    'INR',
        name:        'Krishnamargam',
        description: course.title_en,
        order_id:    razorpayOrderId,
        handler: () => {
          // Webhook will activate enrollment; redirect student to confirmation
          router.push(`/payment/confirm?courseId=${course.id}&istHour=${istHour}`)
        },
        prefill: { email: user.email ?? undefined },
        theme:   { color: '#f0b429' },
        modal:   { ondismiss: () => setLoading(false) },
      })
      rzp.open()
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
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

            {/* Razorpay branding */}
            <div className="bg-white/5 border border-brand-border rounded-xl p-5 mb-5 text-center">
              <div className="text-brand-gold-muted text-sm mb-1">Secure payment via</div>
              <div className="text-brand-body font-semibold">Razorpay · UPI · Cards · NetBanking</div>
              <div className="text-brand-gold-muted text-xs mt-2">You will be redirected to Razorpay checkout</div>
            </div>

            {error && (
              <div className="p-3 rounded-lg mb-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleCompletePayment}
              disabled={loading}
              className="w-full py-3 bg-brand-gold text-brand-bg font-bold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-70"
            >
              {loading ? '...' : `Pay ₹${course.price}`}
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
