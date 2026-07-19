import { createClient } from '@/lib/supabase/client'
import type { Course } from '@/types'
import { COURSES } from '@/lib/courseData'

type CourseRow = Course & { lessons?: { id: number }[] }

function stripLessons(row: CourseRow): Course {
  const { lessons: _lessons, ...course } = row
  return course
}

// Simple in-memory cache with TTL
const cache = new Map<string, { data: unknown; expires: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

export function getCoursesCacheKey(options?: Record<string, unknown>): string {
  if (!options) return 'all_courses'
  return `courses_${JSON.stringify(options)}`
}

function getCachedData<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCachedData<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    expires: Date.now() + CACHE_TTL,
  })
}

export function invalidateCoursesCache(): void {
  cache.clear()
}

/**
 * Fetch courses from database with optional filtering and caching.
 * Gracefully falls back to seed data if database is unavailable.
 */
export async function getCourses(options?: {
  limit?: number
  offset?: number
  pathId?: number
  published?: boolean
}): Promise<Course[]> {
  const cacheKey = getCoursesCacheKey(options)
  const cached = getCachedData<Course[]>(cacheKey)
  if (cached) return cached

  try {
    const supabase = createClient()
    let query = supabase
      .from('courses')
      .select('*, lessons(id)')
      .order('order_index', { ascending: true })

    // Apply filters
    if (options?.pathId) {
      query = query.eq('path_id', options.pathId)
    }
    if (options?.published !== undefined) {
      query = query.eq('is_published', options.published)
    } else {
      // Default: only return published courses to students
      query = query.eq('is_published', true)
    }

    // Apply pagination
    const offset = options?.offset || 0
    const limit = Math.min(options?.limit || 50, 100) // Max 100
    query = query.range(offset, offset + limit - 1)

    const { data, error } = await query

    if (error || !data) {
      console.error('[getCourses] Database query failed:', error?.message)
      // Fallback to seed data
      return COURSES as Course[]
    }

    const courses = (data as CourseRow[]).map(stripLessons)
    setCachedData(cacheKey, courses)
    return courses
  } catch (err) {
    console.error('[getCourses] Exception:', err)
    // Graceful fallback to seed data
    return COURSES as Course[]
  }
}

/**
 * Fetch a single course by slug with caching.
 */
export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const cacheKey = `course_slug_${slug}`
  const cached = getCachedData<Course>(cacheKey)
  if (cached) return cached

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (error || !data) {
      // Try seed data as fallback
      const seedCourse = COURSES.find(c => c.slug === slug)
      if (seedCourse) {
        setCachedData(cacheKey, seedCourse as Course)
        return seedCourse as Course
      }
      return null
    }

    setCachedData(cacheKey, data as Course)
    return data as Course
  } catch (err) {
    console.error('[getCourseBySlug] Exception:', err)
    // Fallback to seed data
    const seedCourse = COURSES.find(c => c.slug === slug)
    return (seedCourse as Course) || null
  }
}

/**
 * Fetch a single course by ID with caching.
 */
export async function getCourseById(id: number): Promise<Course | null> {
  const cacheKey = `course_id_${id}`
  const cached = getCachedData<Course>(cacheKey)
  if (cached) return cached

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      // Try seed data as fallback
      const seedCourse = COURSES.find(c => c.id === id)
      if (seedCourse) {
        setCachedData(cacheKey, seedCourse as Course)
        return seedCourse as Course
      }
      return null
    }

    setCachedData(cacheKey, data as Course)
    return data as Course
  } catch (err) {
    console.error('[getCourseById] Exception:', err)
    // Fallback to seed data
    const seedCourse = COURSES.find(c => c.id === id)
    return (seedCourse as Course) || null
  }
}

/**
 * Get total course count for pagination.
 */
export async function getCoursesCount(filters?: {
  pathId?: number
  published?: boolean
}): Promise<number> {
  try {
    const supabase = createClient()
    let query = supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })

    if (filters?.pathId) {
      query = query.eq('path_id', filters.pathId)
    }
    if (filters?.published !== undefined) {
      query = query.eq('is_published', filters.published)
    } else {
      query = query.eq('is_published', true)
    }

    const { count, error } = await query

    if (error || count === null) {
      console.error('[getCoursesCount] Failed:', error?.message)
      return COURSES.length
    }

    return count
  } catch (err) {
    console.error('[getCoursesCount] Exception:', err)
    return COURSES.length
  }
}
