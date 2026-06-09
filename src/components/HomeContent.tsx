'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Star, Search } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import CourseCard from '@/components/CourseCard'
import CourseDetailOverlay from '@/components/CourseDetailOverlay'
import type { Course, Testimonial } from '@/types'
import type { HomeStats } from '@/lib/homeData'

interface Props {
  courses: Course[]
  stats: HomeStats
  testimonials: Testimonial[]
}

export default function HomeContent({ courses, stats, testimonials }: Props) {
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
  const [activePath, setActivePath] = useState<'all' | 'raas'>('all')

  const topCourses = [...courses].sort((a, b) => b.student_count - a.student_count).slice(0, 6)
  const displayCourses = activePath === 'raas' ? topCourses.filter(c => c.path_id === 1) : topCourses
  const raasCount = courses.filter(c => c.path_id === 1).length

  return (
    <div className="min-h-screen bg-brand-bg">
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
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-gradient py-20 px-4">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
          <span className="text-[280px] font-bold text-brand-gold opacity-[0.04] leading-none">ॐ</span>
        </div>
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="text-5xl mb-4">ॐ</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-brand-gold mb-3">{t.hero.title}</h1>
          <p className="text-xl text-brand-gold-secondary mb-1">{t.hero.tagline}</p>
          <p className="text-lg text-brand-gold-muted mb-8">{t.hero.tagline2}</p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brand-gold-muted" />
            <input
              type="text"
              placeholder={t.hero.searchPlaceholder}
              className="w-full pl-12 pr-4 py-3 bg-brand-card border border-brand-border rounded-xl text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
              readOnly
            />
          </div>
        </div>
      </section>

      {/* Learning Paths */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        <h2 className="text-brand-gold font-bold text-xl text-center mb-6">{t.paths.heading}</h2>
        <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
          <div
            onClick={() => setActivePath(activePath === 'raas' ? 'all' : 'raas')}
            className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
              activePath === 'raas'
                ? 'border-brand-gold bg-brand-gold/5 shadow-lg shadow-brand-gold/10'
                : 'border-brand-border bg-brand-card hover:border-brand-gold/50'
            }`}
          >
            <div className="text-3xl mb-2">ॐ</div>
            <h3 className="text-brand-gold font-bold text-lg">{t.paths.raas.name}</h3>
            <p className="text-brand-gold-muted text-xs mb-2">{t.paths.raas.description}</p>
            <span className="inline-block px-2 py-0.5 bg-brand-gold/20 text-brand-gold text-xs rounded-full font-medium">
              {raasCount} {lang === 'te' ? 'కోర్సులు' : 'courses'}
            </span>
          </div>
          <div className="p-5 rounded-xl border-2 border-brand-border bg-brand-card opacity-60 cursor-not-allowed">
            <div className="text-3xl mb-2">🕊</div>
            <h3 className="text-brand-gold-muted font-bold text-lg">{t.paths.daas.name}</h3>
            <p className="text-brand-gold-muted text-xs mb-2">{t.paths.daas.description}</p>
            <span className="inline-block px-2 py-0.5 bg-brand-border text-brand-gold-muted text-xs rounded-full font-medium">
              {t.paths.daas.courseCount}
            </span>
          </div>
        </div>
      </section>

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
              {displayCourses.map(course => (
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
