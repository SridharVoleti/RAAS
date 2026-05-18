'use client'

import { useState, useMemo } from 'react'
import { useLang } from '@/contexts/LanguageContext'
import CourseCard from '@/components/CourseCard'
import CourseDetailOverlay from '@/components/CourseDetailOverlay'
import { COURSES, CATEGORY_ICONS } from '@/lib/courseData'
import type { Course } from '@/types'

type ViewMode = 'category' | 'level'
type SortMode = 'popular' | 'newest' | 'price-asc' | 'price-desc' | 'rated'

const LEVEL_EMOJIS = { Beginner: '🌱', Intermediate: '🌿', Advanced: '🌳' }

export default function ExplorePage() {
  const { lang, t } = useLang()
  const [view, setView] = useState<ViewMode>('category')
  const [sort, setSort] = useState<SortMode>('popular')
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)

  const sorted = useMemo(() => {
    const c = [...COURSES.filter(x => x.is_published)]
    switch (sort) {
      case 'popular': return c.sort((a, b) => b.student_count - a.student_count)
      case 'newest': return c.sort((a, b) => b.id - a.id)
      case 'price-asc': return c.sort((a, b) => a.price - b.price)
      case 'price-desc': return c.sort((a, b) => b.price - a.price)
      case 'rated': return c.sort((a, b) => b.rating - a.rating)
      default: return c
    }
  }, [sort])

  const categories = useMemo(() => {
    const cats: Record<string, Course[]> = {}
    sorted.forEach(c => {
      if (!cats[c.category]) cats[c.category] = []
      cats[c.category].push(c)
    })
    return cats
  }, [sorted])

  const levels = useMemo(() => {
    const lvls: Record<string, Course[]> = { Beginner: [], Intermediate: [], Advanced: [] }
    sorted.forEach(c => lvls[c.level].push(c))
    return lvls
  }, [sorted])

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="text-brand-gold font-bold text-2xl mb-6">{t.explore.title}</h1>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-4 mb-8 p-4 bg-brand-card border border-brand-border rounded-xl">
          {/* View toggle */}
          <div className="flex bg-brand-bg rounded-lg border border-brand-border overflow-hidden">
            <button
              onClick={() => setView('category')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === 'category' ? 'bg-brand-gold text-brand-bg' : 'text-brand-gold-muted hover:text-brand-gold'
              }`}
            >
              {t.explore.byCategory}
            </button>
            <button
              onClick={() => setView('level')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                view === 'level' ? 'bg-brand-gold text-brand-bg' : 'text-brand-gold-muted hover:text-brand-gold'
              }`}
            >
              {t.explore.byLevel}
            </button>
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortMode)}
            className="px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm focus:outline-none focus:border-brand-gold"
          >
            <option value="popular">{t.explore.mostPopular}</option>
            <option value="newest">{t.explore.newest}</option>
            <option value="price-asc">{t.explore.priceLowHigh}</option>
            <option value="price-desc">{t.explore.priceHighLow}</option>
            <option value="rated">{t.explore.highestRated}</option>
          </select>

          <span className="text-brand-gold-muted text-sm ml-auto">
            {COURSES.length} courses
          </span>
        </div>

        {/* By Category */}
        {view === 'category' && (
          <div className="space-y-10">
            {Object.entries(categories).map(([cat, courses]) => (
              <section key={cat}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{CATEGORY_ICONS[cat] || '📚'}</span>
                  <h2 className="text-brand-gold font-bold text-lg">
                    {lang === 'te' ? (t.categories as Record<string, string>)[cat] || cat : cat}
                  </h2>
                  <span className="text-brand-gold-muted text-sm">({courses.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {courses.map(c => (
                    <CourseCard key={c.id} course={c} onClick={setSelectedCourse} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* By Level */}
        {view === 'level' && (
          <div className="space-y-10">
            {(Object.entries(levels) as [string, Course[]][]).filter(([, c]) => c.length > 0).map(([level, courses]) => (
              <section key={level}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{LEVEL_EMOJIS[level as keyof typeof LEVEL_EMOJIS]}</span>
                  <h2 className="text-brand-gold font-bold text-lg">
                    {t.levels[level as keyof typeof t.levels]}
                  </h2>
                  <span className="text-brand-gold-muted text-sm">({courses.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {courses.map(c => (
                    <CourseCard key={c.id} course={c} onClick={setSelectedCourse} />
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
