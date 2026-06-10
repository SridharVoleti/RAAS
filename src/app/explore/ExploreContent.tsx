'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useLang } from '@/contexts/LanguageContext'
import CourseCard from '@/components/CourseCard'
import CourseDetailOverlay from '@/components/CourseDetailOverlay'
import { CATEGORY_ICONS } from '@/lib/courseData'
import { getCourses } from '@/lib/getCourses'
import type { Course } from '@/types'

type ViewMode = 'category' | 'level'
type SortMode = 'popular' | 'newest' | 'price-asc' | 'price-desc' | 'rated'

const LEVEL_EMOJIS = { Beginner: '🌱', Intermediate: '🌿', Advanced: '🌳' }

// RAAS = path_id 1; extend here when DAAS (path_id 2) launches
const PATH_FILTER: Record<string, number> = { raas: 1 }

export default function ExploreContent() {
  const { lang, t } = useLang()
  const searchParams = useSearchParams()
  const pathParam = searchParams.get('path')?.toLowerCase() ?? null
  const qParam    = searchParams.get('q') ?? ''

  const [view, setView]   = useState<ViewMode>('category')
  const [sort, setSort]   = useState<SortMode>('popular')
  const [search, setSearch] = useState(qParam)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [courses, setCourses] = useState<Course[]>([])

  // Keep local search box in sync when URL q param changes
  useEffect(() => { setSearch(qParam) }, [qParam])

  useEffect(() => {
    getCourses({ limit: 100 })
      .then(data => setCourses(data))
      .catch(err => { console.error('Failed to load courses:', err) })
  }, [])

  const pathId = pathParam ? PATH_FILTER[pathParam] ?? null : null
  const pathLabel = pathParam === 'raas' ? 'RAAS — Vedic & Spiritual Learning' : null

  const filtered = useMemo(() => {
    let c = courses.filter(x => x.is_published)
    if (pathId !== null) c = c.filter(x => x.path_id === pathId)
    if (search.trim()) {
      const q = search.toLowerCase()
      c = c.filter(x =>
        x.title_en.toLowerCase().includes(q) ||
        x.title_te.toLowerCase().includes(q) ||
        x.description_en.toLowerCase().includes(q) ||
        x.category.toLowerCase().includes(q) ||
        x.instructor_en.toLowerCase().includes(q)
      )
    }
    return c
  }, [courses, pathId, search])

  const sorted = useMemo(() => {
    const c = [...filtered]
    switch (sort) {
      case 'popular':    return c.sort((a, b) => b.student_count - a.student_count)
      case 'newest':     return c.sort((a, b) => b.id - a.id)
      case 'price-asc':  return c.sort((a, b) => a.price - b.price)
      case 'price-desc': return c.sort((a, b) => b.price - a.price)
      case 'rated':      return c.sort((a, b) => b.rating - a.rating)
      default:           return c
    }
  }, [filtered, sort])

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
        {/* Heading — changes when a path filter is active */}
        {pathLabel ? (
          <div className="mb-6">
            <h1 className="text-brand-gold font-bold text-2xl">{pathLabel}</h1>
            <p className="text-brand-gold-muted text-sm mt-1">
              {sorted.length} {lang === 'te' ? 'కోర్సులు అందుబాటులో ఉన్నాయి' : 'courses available'}
            </p>
          </div>
        ) : (
          <h1 className="text-brand-gold font-bold text-2xl mb-6">{t.explore.title}</h1>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-8 p-4 bg-brand-card border border-brand-border rounded-xl">
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

          {/* Inline search filter */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t.hero.searchPlaceholder}
            className="flex-1 min-w-[160px] px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold"
          />

          <span className="text-brand-gold-muted text-sm ml-auto">
            {sorted.length} {lang === 'te' ? 'కోర్సులు' : 'courses'}
          </span>
        </div>

        {sorted.length === 0 && (
          <div className="text-center py-16 text-brand-gold-muted">
            {lang === 'te' ? 'కోర్సులు కనుగొనబడలేదు.' : 'No courses found.'}
            {search && (
              <button
                onClick={() => setSearch('')}
                className="block mx-auto mt-3 text-brand-gold text-sm hover:underline"
              >
                {lang === 'te' ? 'శోధన క్లియర్ చేయండి' : 'Clear search'}
              </button>
            )}
          </div>
        )}

        {view === 'category' && sorted.length > 0 && (
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
                    <CourseCard key={c.id} course={c} onClick={setSelectedCourse} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {view === 'level' && sorted.length > 0 && (
          <div className="space-y-10">
            {(Object.entries(levels) as [string, Course[]][])
              .filter(([, c]) => c.length > 0)
              .map(([level, lvlCourses]) => (
                <section key={level}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{LEVEL_EMOJIS[level as keyof typeof LEVEL_EMOJIS]}</span>
                    <h2 className="text-brand-gold font-bold text-lg">
                      {t.levels[level as keyof typeof t.levels]}
                    </h2>
                    <span className="text-brand-gold-muted text-sm">({lvlCourses.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {lvlCourses.map(c => (
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
