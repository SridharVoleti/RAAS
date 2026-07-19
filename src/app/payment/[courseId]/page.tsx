'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { getCourseById, getCourseBySlug } from '@/lib/getCourses'
import type { Course } from '@/types'

export default function PaymentPage() {
  const { t } = useLang()
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const [course, setCourse] = useState<Course | null>(null)
  const [loading, setLoading] = useState<'pay' | 'scholarship' | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  // TODO: Razorpay isn't configured yet — both options enroll directly for now.
  async function handleEnroll(source: 'pay' | 'scholarship') {
    if (!course) return
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
            <div className="text-brand-gold font-bold text-lg flex-shrink-0">₹{course.price}</div>
          </div>

          <div className="p-6 space-y-3">
            <h2 className="text-brand-gold font-bold text-lg text-center mb-5">{t.payment.title}</h2>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Option 1: Donate */}
            <button
              onClick={() => handleEnroll('pay')}
              disabled={loading !== null}
              className="w-full p-4 bg-brand-gold text-brand-bg rounded-xl text-left hover:bg-yellow-400 transition-colors disabled:opacity-60 group"
            >
              <div className="font-bold text-sm">{t.payment.optionPay}</div>
              {loading === 'pay' && <div className="text-brand-bg/70 text-xs mt-1">Loading…</div>}
            </button>

            {/* Option 2: Free access */}
            <button
              onClick={() => handleEnroll('scholarship')}
              disabled={loading !== null}
              className="w-full p-4 bg-brand-bg border border-brand-border rounded-xl text-left hover:border-brand-gold transition-colors disabled:opacity-60"
            >
              <div className="text-brand-body font-semibold text-sm">{t.payment.optionCannotPay}</div>
              {loading === 'scholarship' && <div className="text-brand-gold-muted text-xs mt-1">Loading…</div>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
