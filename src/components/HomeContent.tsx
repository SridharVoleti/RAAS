'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import CourseDetailOverlay from '@/components/CourseDetailOverlay'
import PriorLearningDialog from '@/components/PriorLearningDialog'
import TestimonialDialog from '@/components/TestimonialDialog'
import WelcomeVideoDialog from '@/components/WelcomeVideoDialog'
import LaunchCountdown from '@/components/LaunchCountdown'
import { createClient } from '@/lib/supabase/client'
import type { Course, LearningPath, Testimonial, TextWidget } from '@/types'
import type { HomeStats } from '@/lib/homeData'

// Rich-text styling shared by home-section widgets and the widget dialog box
const WIDGET_HTML_CLASSES = [
  'flow-root text-brand-body text-sm leading-relaxed',
  '[&_h1]:text-brand-gold [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-1',
  '[&_h2]:text-brand-gold [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-1',
  '[&_h3]:text-brand-gold [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-1.5',
  '[&_p]:mb-2 [&_p:last-child]:mb-0',
  '[&_a]:text-brand-gold [&_a]:underline [&_a]:hover:text-yellow-300 [&_a]:transition-colors [&_a]:cursor-pointer',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2',
  '[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2',
  '[&_li]:mb-1',
  '[&_strong]:font-bold [&_em]:italic [&_u]:underline',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-brand-gold [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-brand-gold-muted',
  '[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg',
].join(' ')

interface Props {
  courses: Course[]
  paths: LearningPath[]
  stats: HomeStats
  testimonials: Testimonial[]
  widgets: TextWidget[]
  isLive: boolean
  launchAt: string
}

export default function HomeContent({ courses, paths, stats, testimonials, widgets, isLive, launchAt }: Props) {
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
  const [isAdmin, setIsAdmin] = useState(false)
  const locked = !isLive && !isAdmin
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false)
  const [plDialogOpen, setPlDialogOpen] = useState(false)

  // Reopen the guru-learning dialog after a login round-trip (?pl=1)
  useEffect(() => {
    if (searchParams.get('pl') === '1') {
      setPlDialogOpen(true)
      const url = new URL(window.location.href)
      url.searchParams.delete('pl')
      router.replace(url.pathname)
    }
  }, [searchParams, router])

  function handleGuruRegister() {
    if (locked) return
    if (isLoggedIn) setPlDialogOpen(true)
    else router.push(`/login?returnTo=${encodeURIComponent('/?pl=1')}`)
  }

  // Bumping this reopens the welcome YouTube video (WelcomeVideoDialog)
  const [videoSignal, setVideoSignal] = useState(0)

  // Dialog links inside widget HTML: <a data-dialog="…" data-dialog-title="…">
  const [widgetDialog, setWidgetDialog] = useState<{ title?: string; text: string } | null>(null)

  function handleWidgetClick(e: React.MouseEvent<HTMLDivElement>) {
    const anchor = (e.target as HTMLElement).closest('a[data-dialog]') as HTMLAnchorElement | null
    if (!anchor) return
    e.preventDefault()
    setWidgetDialog({
      title: anchor.dataset.dialogTitle || undefined,
      text:  anchor.dataset.dialog ?? '',
    })
  }

  useEffect(() => {
    const supabase = createClient()

    async function syncIsAdmin(userId?: string) {
      if (!userId) { setIsAdmin(false); return }
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
      setIsAdmin(!!data?.is_admin)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session)
      syncIsAdmin(session?.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
      syncIsAdmin(session?.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  const raasPath = paths.find(p => p.slug === 'raas')
  const otherPaths = paths.filter(p => p.slug !== 'raas')

  const announcementWidgets = widgets.filter(w => w.position === 'announcement')
  const homeSectionWidgets  = widgets.filter(w => w.position === 'home-section')

  return (
    <div className="min-h-screen bg-brand-bg">
      {locked && <LaunchCountdown launchAt={launchAt} />}

      {/* Admin announcement widgets */}
      {announcementWidgets.map(w => (
        <div key={w.id} className="w-full bg-brand-gold/10 border-b border-brand-gold/20 px-4 py-2.5 text-center">
          <div
            className="text-brand-gold text-sm font-medium [&_a]:underline [&_a]:hover:text-yellow-300 [&_a]:cursor-pointer [&_strong]:font-bold [&_em]:italic [&_u]:underline"
            onClick={handleWidgetClick}
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
      {/* Guru-learning marquee: Login + register links rolling above Choose Your Path */}
      <div className="pl-marquee overflow-hidden border-y border-brand-gold/25 bg-brand-gold/5 py-2.5">
        <div className="pl-marquee-track" style={{ animationDuration: '28s' }}>
          {[0, 1].map(copy => (
            <div key={copy} className="flex items-center shrink-0">
              {isLoggedIn === false && (
                <button
                  onClick={() => router.push('/login')}
                  className="mx-10 flex items-center gap-2 text-brand-gold text-sm font-medium hover:underline"
                >
                  <span aria-hidden>🔑</span>
                  {t.priorLearning.marqueeLogin}
                </button>
              )}
              <button
                onClick={() => setVideoSignal(s => s + 1)}
                className="mx-10 flex items-center gap-2 text-brand-gold text-sm font-medium hover:underline"
              >
                <span aria-hidden>🎧</span>
                {t.priorLearning.marqueeNewStudent}
              </button>
              <button
                onClick={handleGuruRegister}
                className="mx-10 flex items-center gap-2 text-brand-gold text-sm font-medium hover:underline"
              >
                <span aria-hidden>🎓</span>
                {t.priorLearning.marqueeRegister}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Learning Paths — driven by the paths table; RAAS is always featured */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        {raasPath && (() => {
          const fullName = lang === 'te' && raasPath.full_name_te ? raasPath.full_name_te : raasPath.full_name_en
          const tagline = lang === 'te' && raasPath.tagline_te ? raasPath.tagline_te : raasPath.tagline_en
          const count = courses.filter(c => c.path_id === raasPath.id && c.is_published).length

          return (
            <div className="flex flex-col md:flex-row items-stretch gap-5 mb-10">
              <div className="w-full md:w-72 lg:w-80 shrink-0 rounded-2xl border-2 border-brand-border bg-brand-card p-5">
                <ul className="space-y-3.5">
                  <li>
                    <button
                      onClick={() => setVideoSignal(s => s + 1)}
                      className="flex items-start gap-2.5 text-left text-brand-gold-muted hover:text-brand-gold text-sm leading-snug transition-colors"
                    >
                      <span aria-hidden className="mt-0.5">🎧</span>
                      <span>{t.home.listenPrompt}</span>
                    </button>
                  </li>
                  {isLoggedIn === false && (
                    <li>
                      <button
                        onClick={() => router.push('/register')}
                        className="flex items-start gap-2.5 text-left text-brand-gold-muted hover:text-brand-gold text-sm leading-snug transition-colors"
                      >
                        <span aria-hidden className="mt-0.5">📝</span>
                        <span>{t.home.enrollCta}</span>
                      </button>
                    </li>
                  )}
                  {isLoggedIn === false && (
                    <li>
                      <button
                        onClick={() => router.push('/login')}
                        className="flex items-start gap-2.5 text-left text-brand-gold-muted hover:text-brand-gold text-sm leading-snug transition-colors"
                      >
                        <span aria-hidden className="mt-0.5">🔑</span>
                        <span>{t.home.loginCta}</span>
                      </button>
                    </li>
                  )}
                  <li>
                    <button
                      onClick={handleGuruRegister}
                      className="flex items-start gap-2.5 text-left text-brand-gold-muted hover:text-brand-gold text-sm leading-snug transition-colors"
                    >
                      <span aria-hidden className="mt-0.5">🎓</span>
                      <span>{t.home.guruPrompt}</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={handleGuruRegister}
                      className="flex items-start gap-2.5 text-left text-brand-gold-muted hover:text-brand-gold text-sm leading-snug transition-colors"
                    >
                      <span aria-hidden className="mt-0.5">📜</span>
                      <span>{t.home.examCta}</span>
                    </button>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => { if (!locked) router.push(`/explore?path=${raasPath.slug}`) }}
                disabled={locked}
                className={`flex-1 p-8 rounded-2xl border-2 border-brand-gold bg-gradient-to-br from-brand-gold/10 via-brand-card to-brand-card transition-all text-left group ${locked ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-xl hover:shadow-brand-gold/20 cursor-pointer'}`}
              >
                <h2 className="text-brand-gold font-bold text-2xl sm:text-3xl group-hover:text-yellow-300 transition-colors">
                  {raasPath.name}
                </h2>
                {fullName && <p className="text-brand-gold-muted text-sm italic leading-snug mt-1 mb-2">{fullName}</p>}
                <p className="text-brand-gold-muted text-sm mb-4 max-w-md">{tagline}</p>
                <div className="flex items-center gap-3">
                  <span className="inline-block px-3 py-1 bg-brand-gold/20 text-brand-gold text-sm rounded-full font-medium">
                    {count} {lang === 'te' ? 'కోర్సులు' : 'courses'}
                  </span>
                  <span className="text-brand-gold-muted text-sm group-hover:text-brand-gold transition-colors">
                    {lang === 'te' ? 'వీక్షించండి →' : 'View →'}
                  </span>
                </div>
              </button>

              <div className="relative w-full h-64 sm:h-72 md:h-auto md:w-56 lg:w-64 shrink-0 rounded-2xl overflow-hidden border-2 border-brand-gold/40">
                <Image
                  src="/ramanuja-acharya.jpg"
                  alt="Sri Ramanujacharya"
                  fill
                  sizes="(min-width: 768px) 256px, 100vw"
                  className="object-cover object-top"
                />
              </div>
            </div>
          )
        })()}

        {otherPaths.length > 0 && (
          <>
            <h3 className="text-brand-gold-muted font-semibold text-sm text-center mb-4">
              {t.paths.otherHeading}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
              {otherPaths.map(path => {
                const fullName = lang === 'te' && path.full_name_te ? path.full_name_te : path.full_name_en
                const tagline = lang === 'te' && path.tagline_te ? path.tagline_te : path.tagline_en
                const count = courses.filter(c => c.path_id === path.id && c.is_published).length

                if (!path.is_active) {
                  return (
                    <div key={path.id} className="p-5 rounded-xl border-2 border-brand-border bg-brand-card opacity-60 cursor-not-allowed relative overflow-hidden">
                      <div className="absolute top-2 right-2">
                        <span className="px-2 py-0.5 bg-brand-border text-brand-gold-muted text-[10px] rounded-full font-medium">
                          {lang === 'te' ? 'త్వరలో' : 'Coming Soon'}
                        </span>
                      </div>
                      <h3 className="text-brand-gold-muted font-bold text-lg">{path.name}</h3>
                      {fullName && <p className="text-brand-gold-muted text-[11px] italic leading-snug mb-1.5">{fullName}</p>}
                      <p className="text-brand-gold-muted text-xs">{tagline}</p>
                    </div>
                  )
                }

                return (
                  <button
                    key={path.id}
                    onClick={() => { if (!locked) router.push(`/explore?path=${path.slug}`) }}
                    disabled={locked}
                    className={`p-5 rounded-xl border-2 border-brand-border bg-brand-card transition-all text-left group ${locked ? 'opacity-70 cursor-not-allowed' : 'hover:border-brand-gold hover:bg-brand-gold/5 hover:shadow-lg hover:shadow-brand-gold/10 cursor-pointer'}`}
                  >
                    <h3 className="text-brand-gold font-bold text-lg group-hover:text-yellow-300 transition-colors">
                      {path.name}
                    </h3>
                    {fullName && <p className="text-brand-gold-muted text-[11px] italic leading-snug mb-1.5">{fullName}</p>}
                    <p className="text-brand-gold-muted text-xs mb-2">{tagline}</p>
                    <div className="flex items-center justify-between">
                      <span className="inline-block px-2 py-0.5 bg-brand-gold/20 text-brand-gold text-xs rounded-full font-medium">
                        {count} {lang === 'te' ? 'కోర్సులు' : 'courses'}
                      </span>
                      <span className="text-brand-gold-muted text-xs group-hover:text-brand-gold transition-colors">
                        {lang === 'te' ? 'వీక్షించండి →' : 'View →'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Home-section widgets */}
      {homeSectionWidgets.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 pb-6">
          <div className="space-y-3">
            {homeSectionWidgets.map(w => (
              <div key={w.id} className="bg-brand-card border border-brand-gold/20 rounded-xl px-5 py-4">
                <div
                  className={WIDGET_HTML_CLASSES}
                  onClick={handleWidgetClick}
                  dangerouslySetInnerHTML={{ __html: w.content }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stats bar — live data cached 24h */}
      <section className="border-y border-brand-border bg-brand-card py-6 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 gap-6 text-center">
          <div>
            <div className="text-brand-gold font-bold text-2xl">{stats.activeUsers.toLocaleString()}+</div>
            <div className="text-brand-gold-muted text-xs mt-1">{t.stats.activeUsers}</div>
          </div>
          <div>
            <div className="text-brand-gold font-bold text-2xl">{stats.coursesAvailable}</div>
            <div className="text-brand-gold-muted text-xs mt-1">{t.stats.courses}</div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-3xl mx-auto px-4 py-10">
        <h2 className="text-brand-gold font-bold text-xl mb-6">{t.home.studentVoices}</h2>
        {testimonials.length > 1 ? (
          <div className="voices-marquee relative overflow-hidden max-h-[600px] lg:max-h-[70vh]">
            {/* List rendered twice so the -50% translate loops seamlessly */}
            <div
              className="voices-marquee-track"
              style={{ animationDuration: `${testimonials.length * 7}s` }}
            >
              {[...testimonials, ...testimonials].map((testimonial, i) => (
                <div key={`${testimonial.id}-${i}`} className="pb-4">
                  <TestimonialCard
                    testimonial={testimonial}
                    lang={lang}
                    courseTitle={courses.find(c => c.id === testimonial.course_id)?.title_en}
                  />
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-brand-bg to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-brand-bg to-transparent" />
          </div>
        ) : testimonials.length === 1 ? (
          <TestimonialCard
            testimonial={testimonials[0]}
            lang={lang}
            courseTitle={courses.find(c => c.id === testimonials[0].course_id)?.title_en}
          />
        ) : null}
        {isLoggedIn && (
          <button
            onClick={() => setVoiceDialogOpen(true)}
            className="w-full mt-4 py-2.5 border border-brand-gold text-brand-gold rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors font-medium text-sm"
          >
            {t.voices.shareButton}
          </button>
        )}
      </section>

      {/* Dialog box opened from a widget dialog-link */}
      {widgetDialog && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setWidgetDialog(null)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-brand-card border border-brand-border rounded-2xl p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="text-brand-gold font-bold text-lg">{widgetDialog.title ?? ''}</h2>
              <button
                onClick={() => setWidgetDialog(null)}
                className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-brand-gold-muted hover:text-brand-gold hover:bg-brand-border/50 transition-colors"
              >
                ✕
              </button>
            </div>
            <p className="text-brand-body text-sm leading-relaxed whitespace-pre-wrap">{widgetDialog.text}</p>
          </div>
        </>
      )}

      <CourseDetailOverlay course={selectedCourse} onClose={() => setSelectedCourse(null)} />
      <TestimonialDialog open={voiceDialogOpen} onClose={() => setVoiceDialogOpen(false)} />
      <PriorLearningDialog open={plDialogOpen} onClose={() => setPlDialogOpen(false)} />
      <WelcomeVideoDialog openSignal={videoSignal} />
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
