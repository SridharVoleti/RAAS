'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { BookOpen, GraduationCap, Headphones, Home, MessageCircle, UserRound } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import PriorLearningDialog from '@/components/PriorLearningDialog'
import TestimonialDialog from '@/components/TestimonialDialog'
import WelcomeVideoDialog from '@/components/WelcomeVideoDialog'
import LaunchCountdown from '@/components/LaunchCountdown'
import type { Course, LearningPath, Testimonial, TextWidget } from '@/types'
import type { HomeStats } from '@/lib/homeData'

interface Props {
  courses: Course[]
  paths: LearningPath[]
  stats: HomeStats
  testimonials: Testimonial[]
  widgets: TextWidget[]
  isLive: boolean
  launchAt: string
}

export default function MobileHomeContent({ courses, paths, stats, isLive, launchAt }: Props) {
  const { lang, t } = useLang()
  const router = useRouter()
  const [plDialogOpen, setPlDialogOpen] = useState(false)
  const [testimonialOpen, setTestimonialOpen] = useState(false)
  const [videoSignal, setVideoSignal] = useState(0)

  const raasPath = paths.find(path => path.slug === 'raas')
  const otherPaths = paths.filter(path => path.slug !== 'raas')
  const locked = !isLive

  const raasCourseCount = raasPath
    ? courses.filter(course => course.path_id === raasPath.id && course.is_published).length
    : 0

  const raasFullName = raasPath
    ? (lang === 'te' && raasPath.full_name_te ? raasPath.full_name_te : raasPath.full_name_en)
    : ''
  const raasTagline = raasPath
    ? (lang === 'te' && raasPath.tagline_te ? raasPath.tagline_te : raasPath.tagline_en)
    : ''

  return (
    <div className="min-h-screen bg-brand-bg pb-24 text-brand-body md:hidden">
      {locked && <LaunchCountdown launchAt={launchAt} />}

      <section className="px-4 pt-4">
        <div className="rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-gold/10 via-brand-card to-brand-bg p-5 shadow-lg shadow-black/20">
          <p className="text-brand-gold text-xs font-semibold tracking-[0.16em] uppercase">
            {lang === 'te' ? 'శ్రీ కృష్ణమార్గము' : 'Sri Krishnamargam'}
          </p>
          <h1 className="mt-2 text-xl font-bold text-brand-body leading-snug">
            {lang === 'te' ? 'ఆధ్యాత్మిక అధ్యయనానికి మీ మార్గం' : 'Your path to structured spiritual learning'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-gold-muted">
            {lang === 'te'
              ? 'ఆచార్యుల బోధనలను క్రమబద్ధంగా అధ్యయనం చేసి మీ ప్రయాణాన్ని కొనసాగించండి.'
              : 'Study Acharya teachings through guided courses, discourses and assessments.'}
          </p>
        </div>
      </section>

      {/* Three mobile quick links — intentionally placed immediately before RAAS. */}
      <section className="px-4 pt-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setVideoSignal(signal => signal + 1)}
            className="min-h-28 rounded-2xl border border-brand-border bg-brand-card p-3 text-left active:scale-[0.98] transition-transform"
          >
            <Headphones className="h-5 w-5 text-brand-gold" aria-hidden />
            <p className="mt-3 text-xs font-semibold leading-snug text-brand-body">
              {t.home.listenPrompt}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPlDialogOpen(true)}
            className="min-h-28 rounded-2xl border border-brand-border bg-brand-card p-3 text-left active:scale-[0.98] transition-transform"
          >
            <GraduationCap className="h-5 w-5 text-brand-gold" aria-hidden />
            <p className="mt-3 text-xs font-semibold leading-snug text-brand-body">
              {t.home.guruPrompt}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setPlDialogOpen(true)}
            className="min-h-28 rounded-2xl border border-brand-border bg-brand-card p-3 text-left active:scale-[0.98] transition-transform"
          >
            <BookOpen className="h-5 w-5 text-brand-gold" aria-hidden />
            <p className="mt-3 text-xs font-semibold leading-snug text-brand-body">
              {t.home.examCta}
            </p>
          </button>
        </div>
      </section>

      {raasPath && (
        <section className="px-4 pt-4">
          <button
            type="button"
            disabled={locked}
            onClick={() => !locked && router.push(`/explore?path=${raasPath.slug}`)}
            className={`w-full overflow-hidden rounded-3xl border border-brand-gold/70 bg-gradient-to-br from-brand-gold/10 via-brand-card to-brand-card text-left shadow-xl shadow-black/20 ${locked ? 'opacity-70' : 'active:scale-[0.99] transition-transform'}`}
          >
            <div className="grid grid-cols-[1.25fr_0.75fr] gap-3 p-5">
              <div className="min-w-0">
                <h2 className="text-3xl font-bold tracking-wide text-brand-gold">RAAS</h2>
                {raasFullName && (
                  <p className="mt-2 text-sm italic leading-relaxed text-brand-gold-muted">
                    {raasFullName}
                  </p>
                )}
                {raasTagline && (
                  <p className="mt-2 text-sm leading-relaxed text-brand-body/90">
                    {raasTagline}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-3">
                  <span className="rounded-full bg-brand-gold/20 px-3 py-1 text-xs font-semibold text-brand-gold">
                    {raasCourseCount} {lang === 'te' ? 'కోర్సులు' : 'courses'}
                  </span>
                  <span className="text-xs font-semibold text-brand-body">
                    {lang === 'te' ? 'వీక్షించండి →' : 'View →'}
                  </span>
                </div>
              </div>
              <div className="relative min-h-44 overflow-hidden rounded-2xl border border-brand-gold/40 bg-brand-bg">
                <Image
                  src="/ramanuja-acharya.jpg"
                  alt="Sri Ramanujacharya"
                  fill
                  sizes="38vw"
                  className="object-cover object-top"
                  priority
                />
              </div>
            </div>
          </button>
        </section>
      )}

      {otherPaths.length > 0 && (
        <section className="px-4 pt-4">
          <h3 className="mb-3 text-sm font-semibold text-brand-gold-muted">{t.paths.otherHeading}</h3>
          <div className="space-y-3">
            {otherPaths.map(path => {
              const fullName = lang === 'te' && path.full_name_te ? path.full_name_te : path.full_name_en
              const tagline = lang === 'te' && path.tagline_te ? path.tagline_te : path.tagline_en
              const count = courses.filter(course => course.path_id === path.id && course.is_published).length

              return (
                <button
                  key={path.id}
                  type="button"
                  disabled={!path.is_active || locked}
                  onClick={() => path.is_active && !locked && router.push(`/explore?path=${path.slug}`)}
                  className="w-full rounded-2xl border border-brand-border bg-brand-card p-4 text-left disabled:opacity-60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-bold text-brand-gold">{path.name}</h4>
                      {fullName && <p className="mt-1 text-xs italic text-brand-gold-muted">{fullName}</p>}
                      {tagline && <p className="mt-2 text-sm text-brand-body/85">{tagline}</p>}
                    </div>
                    {!path.is_active && (
                      <span className="shrink-0 rounded-full border border-brand-border px-2 py-1 text-[10px] text-brand-gold-muted">
                        {lang === 'te' ? 'త్వరలో' : 'Coming Soon'}
                      </span>
                    )}
                  </div>
                  {path.is_active && (
                    <div className="mt-3 flex items-center gap-3 text-xs">
                      <span className="rounded-full bg-brand-gold/20 px-2.5 py-1 font-semibold text-brand-gold">
                        {count} {lang === 'te' ? 'కోర్సులు' : 'courses'}
                      </span>
                      <span className="text-brand-body">{lang === 'te' ? 'వీక్షించండి →' : 'View →'}</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      )}

      <section className="px-4 pt-4">
        <div className="grid grid-cols-2 divide-x divide-brand-border rounded-2xl border border-brand-border bg-brand-card py-5 text-center">
          <div>
            <div className="text-3xl font-bold text-brand-gold">{stats.activeUsers}+</div>
            <div className="mt-1 text-xs text-brand-gold-muted">{lang === 'te' ? 'విద్యార్థులు' : 'Students'}</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-brand-gold">{stats.coursesAvailable}</div>
            <div className="mt-1 text-xs text-brand-gold-muted">{lang === 'te' ? 'అందుబాటులో ఉన్న కోర్సులు' : 'Courses available'}</div>
          </div>
        </div>
      </section>

      <section className="px-4 pt-6">
        <h3 className="text-xl font-bold text-brand-gold">{lang === 'te' ? 'విద్యార్థుల అభిప్రాయాలు' : 'Student feedback'}</h3>
        <button
          type="button"
          onClick={() => setTestimonialOpen(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-gold/70 bg-brand-card px-4 py-4 text-sm font-semibold text-brand-gold"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {lang === 'te' ? 'మీ అభిప్రాయాన్ని పంచుకోండి' : 'Share your feedback'}
        </button>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-brand-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <div className="grid grid-cols-4">
          <button className="flex flex-col items-center gap-1 py-2 text-brand-gold" onClick={() => router.push('/')}>
            <Home className="h-5 w-5" aria-hidden />
            <span className="text-[11px]">{lang === 'te' ? 'హోమ్' : 'Home'}</span>
          </button>
          <button className="flex flex-col items-center gap-1 py-2 text-brand-gold-muted" onClick={() => router.push('/explore')}>
            <BookOpen className="h-5 w-5" aria-hidden />
            <span className="text-[11px]">{lang === 'te' ? 'కోర్సులు' : 'Courses'}</span>
          </button>
          <button className="flex flex-col items-center gap-1 py-2 text-brand-gold-muted" onClick={() => router.push('/explore')}>
            <Headphones className="h-5 w-5" aria-hidden />
            <span className="text-[11px]">{lang === 'te' ? 'ప్రవచనాలు' : 'Discourses'}</span>
          </button>
          <button className="flex flex-col items-center gap-1 py-2 text-brand-gold-muted" onClick={() => router.push('/profile')}>
            <UserRound className="h-5 w-5" aria-hidden />
            <span className="text-[11px]">{lang === 'te' ? 'ప్రొఫైల్' : 'Profile'}</span>
          </button>
        </div>
      </nav>

      <PriorLearningDialog open={plDialogOpen} onClose={() => setPlDialogOpen(false)} />
      <WelcomeVideoDialog openSignal={videoSignal} />
      <TestimonialDialog open={testimonialOpen} onClose={() => setTestimonialOpen(false)} />
    </div>
  )
}
