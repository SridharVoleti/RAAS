'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Star, Users, Clock, Check } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils'
import type { Course } from '@/types'

interface Props {
  course: Course | null
  onClose: () => void
}

const LEVEL_COLORS = {
  Beginner: 'text-brand-success border-brand-success bg-brand-success/10',
  Intermediate: 'text-brand-gold border-brand-gold bg-brand-gold/10',
  Advanced: 'text-brand-error border-brand-error bg-brand-error/10',
}

const BADGE_STYLES = {
  Popular: 'bg-brand-gold text-brand-bg',
  New: 'bg-brand-success text-brand-bg',
  Free: 'bg-blue-500 text-white',
}

export default function CourseDetailOverlay({ course, onClose }: Props) {
  const { lang, t } = useLang()
  const router = useRouter()
  const supabase = createClient()
  const [enrolling, setEnrolling] = useState(false)
  const [isEnrolled, setIsEnrolled] = useState(false)

  useEffect(() => {
    if (!course) return
    document.body.style.overflow = 'hidden'
    checkEnrollment()
    return () => { document.body.style.overflow = '' }
  }, [course])

  async function checkEnrollment() {
    if (!course) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('enrollments')
      .select('is_active')
      .eq('user_id', user.id)
      .eq('course_id', course.id)
      .single()
    setIsEnrolled(!!data?.is_active)
  }

  async function handleEnroll() {
    if (!course) return
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push(`/login?returnTo=/payment/${course.id}`)
      return
    }

    if (course.is_free) {
      setEnrolling(true)
      try {
        const res = await fetch('/api/enroll/free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: course.id }),
        })
        if (res.ok) {
          setIsEnrolled(true)
          router.push(`/watch/${course.slug}`)
        }
      } finally {
        setEnrolling(false)
      }
    } else {
      router.push(`/payment/${course.id}`)
    }
  }

  if (!course) return null

  const title = lang === 'te' ? course.title_te : course.title_en
  const subtitle = lang === 'te' ? course.title_en : course.title_te
  const description = lang === 'te' ? course.description_te : course.description_en
  const instructor = lang === 'te' ? course.instructor_te : course.instructor_en

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-brand-card border-l border-brand-border z-50 overflow-y-auto flex flex-col animate-slide-in">
        {/* Emoji banner */}
        <div
          className="h-48 flex items-center justify-center text-8xl relative flex-shrink-0"
          style={{ backgroundColor: course.bg_color }}
        >
          <span>{course.emoji}</span>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 pb-24">
          {/* Badge row */}
          <div className="flex items-center gap-2 mb-3">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${BADGE_STYLES[course.badge]}`}>
              {course.badge === 'Free' ? t.course.free : course.badge}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${LEVEL_COLORS[course.level]}`}>
              {t.levels[course.level]}
            </span>
          </div>

          {/* Title */}
          <h2 className="text-brand-gold font-bold text-xl mb-1">{title}</h2>
          {subtitle && <p className="text-brand-gold-muted text-sm mb-4">{subtitle}</p>}

          {/* Meta row */}
          <div className="flex items-center gap-4 text-brand-gold-muted text-sm mb-5">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-brand-gold text-brand-gold" />
              <span className="text-brand-gold font-semibold">{course.rating}</span>
              <span>({course.review_count})</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{course.student_count.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{course.duration}</span>
            </div>
          </div>

          {/* Instructor card */}
          <div className="flex items-center gap-3 p-3 bg-brand-bg rounded-xl border border-brand-border mb-5">
            <div className="w-10 h-10 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg font-bold text-sm flex-shrink-0">
              {instructor?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-brand-body font-medium text-sm">{instructor}</p>
              <p className="text-brand-gold-muted text-xs">{t.course.instructor}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-brand-body text-sm leading-relaxed mb-5">{description}</p>

          {/* Curriculum */}
          {course.curriculum && (
            <div className="mb-5">
              <h3 className="text-brand-gold font-semibold mb-3">{t.course.whatYouLearn}</h3>
              <ul className="space-y-2">
                {course.curriculum.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-brand-body">
                    <Check className="w-4 h-4 text-brand-success flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 bg-brand-card border-t border-brand-border p-4 flex items-center justify-between">
          <div>
            <span className={`text-xl font-bold ${course.is_free ? 'text-brand-success' : 'text-brand-gold'}`}>
              {formatPrice(course.price)}
            </span>
          </div>
          {isEnrolled ? (
            <button
              onClick={() => router.push(`/watch/${course.slug}`)}
              className="px-6 py-2.5 bg-brand-success text-brand-bg font-semibold rounded-lg hover:bg-green-400 transition-colors"
            >
              {t.course.continueLearning}
            </button>
          ) : (
            <button
              onClick={handleEnroll}
              disabled={enrolling}
              className="px-6 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-70"
            >
              {enrolling ? '...' : course.is_free ? t.course.enrollFree : t.course.enroll}
            </button>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </>
  )
}
