'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/contexts/LanguageContext'
import CourseCard from '@/components/CourseCard'
import CourseDetailOverlay from '@/components/CourseDetailOverlay'
import { CATEGORY_ICONS } from '@/lib/courseData'
import { getCourses } from '@/lib/getCourses'
import { getPaths } from '@/lib/getPaths'
import type { Course, LearningPath } from '@/types'

export default function ExploreContent() {
  const { lang, t } = useLang()
  const searchParams = useSearchParams()
  const pathParam = searchParams.get('path')?.toLowerCase() ?? null

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courses, setCourses] = useState<Course[]>([])
  const [paths, setPaths] = useState<LearningPath[]>([])
  const [enrolledIds, setEnrolledIds] = useState<Set<number>>(new Set())
  const [enrollmentCounts, setEnrollmentCounts] = useState<Record<number, number>>({})

  useEffect(() => {
    getCourses({ limit: 100 })
      .then(data => setCourses(data))
      .catch(err => { console.error('Failed to load courses:', err) })
    getPaths()
      .then(data => setPaths(data))
      .catch(() => {})
    fetch('/api/my-courses')
      .then(res => (res.ok ? res.json() : []))
      .then((data: { course_id: number }[]) => setEnrolledIds(new Set(data.map(c => c.course_id))))
      .catch(() => {})
    fetch('/api/courses/enrollment-counts')
      .then(res => (res.ok ? res.json() : { counts: {} }))
      .then((data: { counts: Record<string, number> }) => setEnrollmentCounts(data.counts))
      .catch(() => {})
  }, [])

  const activePath = pathParam ? paths.find(p => p.slug === pathParam) ?? null : null
  const pathId = activePath?.id ?? null
  const pathLabel = activePath
    ? `${activePath.name}${(lang === 'te' && activePath.full_name_te) || activePath.full_name_en
        ? ` — ${lang === 'te' && activePath.full_name_te ? activePath.full_name_te : activePath.full_name_en}`
        : ''}`
    : null

  const filtered = useMemo(() => {
    let c = courses
      .filter(x => x.is_published)
      .map(x => ({ ...x, student_count: enrollmentCounts[x.id] ?? x.student_count }))
    if (pathId !== null) c = c.filter(x => x.path_id === pathId)
    return c
  }, [courses, pathId, enrollmentCounts])

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.student_count - a.student_count), [filtered])

  const categories = useMemo(() => {
    const cats: Record<string, Course[]> = {}
    sorted.forEach(c => {
      if (!cats[c.category]) cats[c.category] = []
      cats[c.category].push(c)
    })
    return cats
  }, [sorted])

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Heading — changes when a path filter is active */}
        {pathLabel ? (
          <div className="mb-6">
            <h1 className="text-brand-gold font-bold text-2xl">{pathLabel}</h1>
            <p className="text-brand-gold-muted text-sm mt-1">
              {sorted.length} {lang === 'te' ? 'కోర్సులు అందుబాటులో ఉన్నాయి' : 'courses available'}
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <h1 className="text-brand-gold font-bold text-2xl">{t.explore.title}</h1>
            <p className="text-brand-gold-muted text-sm mt-1">
              {sorted.length} {lang === 'te' ? 'కోర్సులు' : 'courses'}
            </p>
          </div>
        )}

        {sorted.length === 0 && (
          <div className="text-center py-16 text-brand-gold-muted">
            {lang === 'te' ? 'కోర్సులు కనుగొనబడలేదు.' : 'No courses found.'}
          </div>
        )}

        {sorted.length > 0 && (
          <div className="space-y-10">
            {Object.entries(categories).map(([cat, catCourses]) => (
              <section key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{CATEGORY_ICONS[cat] || '📚'}</span>
                  <h2 className="text-brand-gold font-bold text-lg">
                    {lang === 'te' ? (t.categories as Record<string, string>)[cat] || cat : cat}
                  </h2>
                  <span className="text-brand-gold-muted text-sm">({catCourses.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {catCourses.map(c => (
                    <CourseCard key={c.id} course={c} onClick={setSelectedCourse} isEnrolled={enrolledIds.has(c.id)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <CourseDetailOverlay course={selectedCourse} onClose={() => setSelectedCourse(null)} />
    </div>
  )
}
