'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useLang } from '@/contexts/LanguageContext'
import PriorLearningDialog from '@/components/PriorLearningDialog'
import WelcomeVideoDialog from '@/components/WelcomeVideoDialog'
import type { Course, LearningPath } from '@/types'

interface Props {
  courses: Course[]
  paths: LearningPath[]
}

interface Declaration {
  course_id: number
}

interface ExamLink {
  courseId: number
  title_en: string
  title_te: string | null
}

export default function StudentHomeContent({ courses, paths }: Props) {
  const { lang, t } = useLang()
  const router = useRouter()
  const [plDialogOpen, setPlDialogOpen] = useState(false)
  const [videoSignal, setVideoSignal] = useState(0)
  const [examLinks, setExamLinks] = useState<ExamLink[]>([])

  useEffect(() => {
    fetch('/api/prior-learning')
      .then(res => (res.ok ? res.json() : { declarations: [] }))
      .then((data: { declarations: Declaration[] }) => {
        const links = data.declarations
          .map(d => courses.find(c => c.id === d.course_id))
          .filter((c): c is Course => !!c && !!c.has_exam)
          .map(c => ({ courseId: c.id, title_en: c.title_en, title_te: c.title_te }))
        setExamLinks(links)
      })
      .catch(() => setExamLinks([]))
  // courses is a stable prop from the server-rendered page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const raasPath = paths.find(p => p.slug === 'raas')
  const otherPaths = paths.filter(p => p.slug !== 'raas')

  return (
    <div className="min-h-screen bg-brand-bg">
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
                  <li>
                    <button
                      onClick={() => setPlDialogOpen(true)}
                      className="flex items-start gap-2.5 text-left text-brand-gold-muted hover:text-brand-gold text-sm leading-snug transition-colors"
                    >
                      <span aria-hidden className="mt-0.5">🎓</span>
                      <span>{t.home.guruPrompt}</span>
                    </button>
                  </li>
                  {examLinks.map(link => (
                    <li key={link.courseId}>
                      <button
                        onClick={() => router.push(`/exam/${link.courseId}`)}
                        className="flex items-start gap-2.5 text-left text-brand-gold-muted hover:text-brand-gold text-sm leading-snug transition-colors"
                      >
                        <span aria-hidden className="mt-0.5">📜</span>
                        <span>
                          {t.priorLearning.takeFinalTest}
                          {': '}
                          {lang === 'te' && link.title_te ? link.title_te : link.title_en}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => router.push(`/explore?path=${raasPath.slug}`)}
                className="flex-1 p-8 rounded-2xl border-2 border-brand-gold bg-gradient-to-br from-brand-gold/10 via-brand-card to-brand-card hover:shadow-xl hover:shadow-brand-gold/20 cursor-pointer transition-all text-left group"
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
                    onClick={() => router.push(`/explore?path=${path.slug}`)}
                    className="p-5 rounded-xl border-2 border-brand-border bg-brand-card hover:border-brand-gold hover:bg-brand-gold/5 hover:shadow-lg hover:shadow-brand-gold/10 cursor-pointer transition-all text-left group"
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

      <PriorLearningDialog open={plDialogOpen} onClose={() => setPlDialogOpen(false)} />
      <WelcomeVideoDialog openSignal={videoSignal} />
    </div>
  )
}
