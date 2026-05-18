'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import CourseDetailOverlay from '@/components/CourseDetailOverlay'
import type { CourseWithProgress, Profile, Course } from '@/types'

export default function MyCoursesPage() {
  const { lang, t } = useLang()
  const router = useRouter()
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [courses, setCourses] = useState<CourseWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login?returnTo=/my-courses'); return }

    const [{ data: prof }, { data: enrolled }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('vw_my_courses').select('*').eq('user_id', user.id),
    ])

    setProfile(prof)
    setCourses(enrolled || [])
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-4xl animate-pulse">ॐ</div>
      </div>
    )
  }

  const enrolled = courses.length
  const inProgress = courses.filter(c => c.progress_pct > 0 && c.progress_pct < 100).length
  const completed = courses.filter(c => c.progress_pct === 100).length

  const getStatus = (c: CourseWithProgress) => {
    if (c.progress_pct === 100) return 'completed'
    if (c.progress_pct > 0) return 'inProgress'
    return 'notStarted'
  }

  const getActionLabel = (c: CourseWithProgress) => {
    const status = getStatus(c)
    if (status === 'completed') return t.course.reviewCourse
    if (status === 'inProgress') return t.course.continueLearning
    return t.course.startLearning
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-xl font-bold">
              {profile?.avatar_initials}
            </div>
            <div>
              <h1 className="text-brand-gold font-bold text-xl">
                {t.myCourses.welcome}, {profile?.full_name.split(' ')[0]}!
              </h1>
              <p className="text-brand-gold-muted text-sm">मीआध्यात्मिकमार्गं</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-brand-bg rounded-xl border border-brand-border">
              <div className="text-brand-gold font-bold text-2xl">{enrolled}</div>
              <div className="text-brand-gold-muted text-xs mt-1">{t.myCourses.enrolled}</div>
            </div>
            <div className="text-center p-3 bg-brand-bg rounded-xl border border-brand-border">
              <div className="text-brand-gold font-bold text-2xl">{inProgress}</div>
              <div className="text-brand-gold-muted text-xs mt-1">{t.myCourses.inProgress}</div>
            </div>
            <div className="text-center p-3 bg-brand-bg rounded-xl border border-brand-border">
              <div className="text-brand-gold font-bold text-2xl">{completed}</div>
              <div className="text-brand-gold-muted text-xs mt-1">{t.myCourses.completed}</div>
            </div>
          </div>
        </div>

        {/* Course grid */}
        {courses.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🪷</div>
            <h2 className="text-brand-gold font-bold text-xl mb-2">{t.myCourses.noCoursesYet}</h2>
            <p className="text-brand-gold-muted text-sm mb-6">Begin your spiritual journey today</p>
            <Link
              href="/explore"
              className="px-6 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
            >
              {t.myCourses.exploreCourses}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map(course => {
              const status = getStatus(course)
              const title = lang === 'te' ? course.title_te || course.title_en : course.title_en
              const instructor = lang === 'te' ? course.instructor_te || course.instructor_en : course.instructor_en

              return (
                <div key={course.id} className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
                  {/* Thumbnail */}
                  <div className="h-28 flex items-center justify-center text-5xl relative" style={{ backgroundColor: course.bg_color }}>
                    <span>{course.emoji}</span>
                    {status === 'completed' && (
                      <div className="absolute top-2 right-2">
                        <Trophy className="w-5 h-5 text-brand-gold" />
                      </div>
                    )}
                    <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                      status === 'completed' ? 'bg-brand-success/90 text-brand-bg' :
                      status === 'inProgress' ? 'bg-brand-gold/90 text-brand-bg' :
                      'bg-brand-border text-brand-gold-muted'
                    }`}>
                      {status === 'completed' ? t.myCourses.completed :
                       status === 'inProgress' ? t.myCourses.inProgress :
                       t.myCourses.notStarted}
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="text-brand-gold font-semibold text-sm mb-0.5 line-clamp-2">{title}</h3>
                    <p className="text-brand-gold-muted text-xs mb-3">{instructor}</p>

                    {/* Progress */}
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-brand-gold-muted mb-1">
                        <span>{t.myCourses.progress}</span>
                        <span>{course.progress_pct}%</span>
                      </div>
                      <div className="h-1.5 bg-brand-bg rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            status === 'completed' ? 'bg-brand-success' :
                            status === 'inProgress' ? 'bg-brand-gold' :
                            'bg-brand-border'
                          }`}
                          style={{ width: `${course.progress_pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-brand-gold-muted text-xs">{course.duration}</span>
                      <button
                        onClick={() => setSelectedCourse(course as Course)}
                        className="px-3 py-1 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                      >
                        {getActionLabel(course)}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CourseDetailOverlay course={selectedCourse} onClose={() => setSelectedCourse(null)} />
    </div>
  )
}
