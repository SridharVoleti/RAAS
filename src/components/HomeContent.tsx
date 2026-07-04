'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Star } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import CourseCard from '@/components/CourseCard'
import CourseDetailOverlay from '@/components/CourseDetailOverlay'
import WelcomeVideoDialog from '@/components/WelcomeVideoDialog'
import { createClient } from '@/lib/supabase/client'
import type { Course, Testimonial, TextWidget } from '@/types'
import type { HomeStats } from '@/lib/homeData'

interface Props {
  courses: Course[]
  stats: HomeStats
  testimonials: Testimonial[]
  widgets: TextWidget[]
}

export default function HomeContent({ courses, stats, testimonials, widgets }: Props) {
  const { lang, t } = useLang()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [verifiedToast, setVerifiedToast] = useState<'success' | 'invalid' | null>(null)

  useEffect(() => {
    const v = searchParams.get('verified')
    if (v === 'true') setVerifiedToast('success')
    else if (v === 'invalid') setVerifiedToast('invalid')
    if (v) {
      const url = new URL(window.location.href)
      url.searchParams.delete('verified')
      router.replace(url.pathname)
    }
  }, [searchParams, router])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => { setIsLoggedIn(!!session) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const topCourses = [...courses].sort((a, b) => b.student_count - a.student_count).slice(0, 6)
  const raasCount = courses.filter(c => c.path_id === 1).length

  const announcementWidgets = widgets.filter(w => w.position === 'announcement')
  const homeSectionWidgets  = widgets.filter(w => w.position === 'home-section')

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* Admin announcement widgets */}
      {announcementWidgets.map(w => (
        <div key={w.id} className="w-full bg-brand-gold/10 border-b border-brand-gold/20 px-4 py-2.5 text-center">
          <div
            className="text-brand-gold text-sm font-medium [&_a]:underline [&_a]:hover:text-yellow-300 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
            dangerouslySetInnerHTML={{ __html: w.content }}
          />
        </div>
      ))}

      {verifiedToast === 'success' && (
        <div className="w-full bg-green-800 border-b border-green-600 text-green-100 text-sm text-center py-2 px-4">
          Your email has been verified successfully. Welcome to Krishnamargam!
        </div>
      )}
      {verifiedToast === 'invalid' && (
        <div className="w-full bg-red-900 border-b border-red-700 text-red-200 text-sm text-center py-2 px-4">
          Verification link is invalid or expired. Please request a new one.
        </div>
      )}
      {/* Sign-up / Sign-in nudge — shown only to guests */}
      {isLoggedIn === false && (
        <div className="max-w-xl mx-auto px-4 pt-8 pb-0">
          <div className="relative flex items-center justify-center gap-3 rounded-xl border border-brand-gold/40 bg-brand-gold/5 px-5 py-3 text-center overflow-hidden">
            {/* twinkling star particles */}
            <span className="absolute left-3 top-2 text-brand-gold text-xs animate-[twinkle_1.6s_ease-in-out_infinite]">✦</span>
            <span className="absolute right-5 bottom-2 text-brand-gold text-[10px] animate-[twinkle_2.1s_ease-in-out_0.4s_infinite]">✦</span>
            <span className="absolute left-[40%] top-1.5 text-brand-gold text-[8px] animate-[twinkle_1.9s_ease-in-out_0.8s_infinite]">✦</span>
            <p className="text-brand-gold text-sm font-medium">
              {lang === 'te'
                ? 'కొత్త వినియోగదారులు '
                : 'New here? '}
              <button
                onClick={() => router.push('/register')}
                className="underline underline-offset-2 hover:text-yellow-300 transition-colors font-semibold"
              >
                {lang === 'te' ? 'నమోదు చేసుకోండి' : 'Sign up'}
              </button>
              {lang === 'te' ? ' లేదా ' : ' or '}
              <button
                onClick={() => router.push('/login')}
                className="underline underline-offset-2 hover:text-yellow-300 transition-colors font-semibold"
              >
                {lang === 'te' ? 'లాగిన్ అవ్వండి' : 'Sign in'}
              </button>
              {lang === 'te' ? ' చేసి మీ అభ్యాసాన్ని ప్రారంభించండి' : ' to start your journey'}
            </p>
          </div>
        </div>
      )}

      {/* Learning Paths */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-brand-gold font-bold text-xl text-center mb-6">{t.paths.heading}</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
          {/* RAAS — clickable, navigates to filtered explore */}
          <button
            onClick={() => router.push('/explore?path=raas')}
            className="p-5 rounded-xl border-2 border-brand-border bg-brand-card hover:border-brand-gold hover:bg-brand-gold/5 hover:shadow-lg hover:shadow-brand-gold/10 cursor-pointer transition-all text-left group"
          >
            <div className="text-3xl mb-2">ॐ</div>
            <h3 className="text-brand-gold font-bold text-lg group-hover:text-yellow-300 transition-colors">
              {t.paths.raas.name}
            </h3>
            <p className="text-brand-gold-muted text-xs mb-2">{t.paths.raas.description}</p>
            <div className="flex items-center justify-between">
              <span className="inline-block px-2 py-0.5 bg-brand-gold/20 text-brand-gold text-xs rounded-full font-medium">
                {raasCount} {lang === 'te' ? 'కోర్సులు' : 'courses'}
              </span>
              <span className="text-brand-gold-muted text-xs group-hover:text-brand-gold transition-colors">
                {lang === 'te' ? 'వీక్షించు →' : 'View →'}
              </span>
            </div>
          </button>

          {/* DAAS — coming soon */}
          <div className="p-5 rounded-xl border-2 border-brand-border bg-brand-card opacity-60 cursor-not-allowed relative overflow-hidden">
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 bg-brand-border text-brand-gold-muted text-[10px] rounded-full font-medium">
                {lang === 'te' ? 'త్వరలో' : 'Coming Soon'}
              </span>
            </div>
            <div className="text-3xl mb-2">🕊</div>
            <h3 className="text-brand-gold-muted font-bold text-lg">{t.paths.daas.name}</h3>
            <p className="text-brand-gold-muted text-xs mb-2">{t.paths.daas.description}</p>
            <span className="inline-block px-2 py-0.5 bg-brand-border text-brand-gold-muted text-xs rounded-full font-medium">
              {t.paths.daas.courseCount}
            </span>
          </div>
        </div>
      </section>

      {/* Home-section widgets */}
      {homeSectionWidgets.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-6">
          <div className="space-y-3">
            {homeSectionWidgets.map(w => (
              <div key={w.id} className="bg-brand-card border border-brand-gold/20 rounded-xl px-5 py-4">
                <div
                  className={[
                    'flow-root text-brand-body text-sm leading-relaxed',
                    '[&_h1]:text-brand-gold [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-1',
                    '[&_h2]:text-brand-gold [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-1',
                    '[&_h3]:text-brand-gold [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1.5',
                    '[&_p]:mb-2 [&_p:last-child]:mb-0',
                    '[&_a]:text-brand-gold [&_a]:underline [&_a]:hover:text-yellow-300 [&_a]:transition-colors',
                    '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2',
                    '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2',
                    '[&_li]:mb-1',
                    '[&_strong]:font-bold [&_em]:italic [&_u]:underline',
                    '[&_blockquote]:border-l-2 [&_blockquote]:border-brand-gold [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-brand-gold-muted',
                    '[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg',
                  ].join(' ')}
                  dangerouslySetInnerHTML={{ __html: w.content }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stats bar — live data cached 24h */}
      <section className="border-y border-brand-border bg-brand-card py-6 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <div className="text-brand-gold font-bold text-2xl">{stats.studentsEnrolled.toLocaleString()}+</div>
            <div className="text-brand-gold-muted text-xs mt-1">{t.stats.enrolled}</div>
          </div>
          <div>
            <div className="text-brand-gold font-bold text-2xl">{stats.coursesAvailable}</div>
            <div className="text-brand-gold-muted text-xs mt-1">{t.stats.courses}</div>
          </div>
          <div>
            <div className="text-brand-gold font-bold text-2xl">{stats.averageRating} ⭐</div>
            <div className="text-brand-gold-muted text-xs mt-1">{t.stats.rating}</div>
          </div>
          <div>
            <div className="text-brand-gold font-bold text-2xl">{stats.languages}</div>
            <div className="text-brand-gold-muted text-xs mt-1">{t.stats.languages}</div>
          </div>
        </div>
      </section>

      {/* Courses + Testimonials */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-[65%]">
            <h2 className="text-brand-gold font-bold text-xl mb-6">{t.home.featuredCourses}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {topCourses.map(course => (
                <CourseCard key={course.id} course={course} onClick={setSelectedCourse} />
              ))}
            </div>
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push('/explore')}
                className="px-6 py-2.5 border border-brand-gold text-brand-gold rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors font-medium"
              >
                {t.explore.title} →
              </button>
            </div>
          </div>

          <div className="lg:w-[35%]">
            <div className="lg:sticky lg:top-20">
              <h2 className="text-brand-gold font-bold text-xl mb-6">{t.home.studentVoices}</h2>
              <div className="space-y-4 max-h-[600px] lg:max-h-[70vh] overflow-y-auto pr-1">
                {testimonials.map(testimonial => (
                  <TestimonialCard
                    key={testimonial.id}
                    testimonial={testimonial}
                    lang={lang}
                    courseTitle={courses.find(c => c.id === testimonial.course_id)?.title_en}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CourseDetailOverlay course={selectedCourse} onClose={() => setSelectedCourse(null)} />
      <WelcomeVideoDialog />
    </div>
  )
}

function TestimonialCard({
  testimonial,
  lang,
  courseTitle,
}: {
  testimonial: Testimonial
  lang: string
  courseTitle?: string
}) {
  const content = lang === 'te' && testimonial.content_te ? testimonial.content_te : testimonial.content_en
  const initials = testimonial.reviewer_name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-xs font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-brand-body font-medium text-sm">{testimonial.reviewer_name}</p>
          {courseTitle && <p className="text-brand-gold-muted text-xs">{courseTitle}</p>}
        </div>
        <div className="ml-auto flex">
          {Array.from({ length: testimonial.rating }).map((_, i) => (
            <Star key={i} className="w-3 h-3 fill-brand-gold text-brand-gold" />
          ))}
        </div>
      </div>
      <p className="text-brand-body text-xs leading-relaxed italic">&ldquo;{content}&rdquo;</p>
      <p className="text-brand-gold-muted text-xs mt-2">{testimonial.created_at}</p>
    </div>
  )
}
