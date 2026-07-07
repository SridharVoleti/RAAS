import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Course, Testimonial, TextWidget } from '@/types'
import { COURSES, STATS } from './courseData'

export interface HomeStats {
  studentsEnrolled: number
  coursesAvailable: number
  averageRating: number
  languages: number
}

// No-cookie client for use inside unstable_cache (runs outside request lifecycle after first call)
function createCacheClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export const getCachedCourses = unstable_cache(
  async (): Promise<Course[]> => {
    try {
      const sb = createCacheClient()
      const { data, error } = await sb
        .from('courses')
        .select('*')
        .eq('is_published', true)
        .order('order_index')
      if (error || !data?.length) return COURSES
      return data as Course[]
    } catch {
      return COURSES
    }
  },
  ['home-courses'],
  { revalidate: 86400, tags: ['courses'] }
)

export const getCachedStats = unstable_cache(
  async (): Promise<HomeStats> => {
    try {
      const sb = createCacheClient()
      const [
        { count: enrolled },
        { count: coursesCount },
        { data: ratingRows },
      ] = await Promise.all([
        sb.from('enrollments').select('*', { count: 'exact', head: true }).eq('is_active', true),
        sb.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
        sb.from('courses').select('rating').eq('is_published', true),
      ])

      const avgRating =
        ratingRows?.length
          ? Math.round(
              (ratingRows.reduce((s: number, r: { rating: unknown }) => s + Number(r.rating), 0) /
                ratingRows.length) *
                10
            ) / 10
          : STATS.averageRating

      return {
        studentsEnrolled: enrolled ?? STATS.studentsEnrolled,
        coursesAvailable: coursesCount ?? STATS.coursesAvailable,
        averageRating: avgRating,
        languages: 2,
      }
    } catch {
      return STATS
    }
  },
  ['home-stats'],
  { revalidate: 86400, tags: ['stats'] }
)

export const getCachedWidgets = unstable_cache(
  async (): Promise<TextWidget[]> => {
    try {
      const sb = createCacheClient()
      const { data, error } = await sb
        .from('text_widgets')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (error || !data) return []
      return data as TextWidget[]
    } catch {
      return []
    }
  },
  ['home-widgets'],
  { revalidate: 300, tags: ['widgets'] }
)

export const getCachedTestimonials = unstable_cache(
  async (): Promise<Testimonial[]> => {
    try {
      const sb = createCacheClient()
      const { data, error } = await sb
        .from('testimonials')
        .select('id, reviewer_name, content_en, content_te, rating, course_id, created_at')
        .eq('is_published', true)
        .order('id', { ascending: false })
        .limit(10)
      if (error || !data) return []
      return data as Testimonial[]
    } catch {
      return []
    }
  },
  ['home-testimonials'],
  { revalidate: 86400, tags: ['testimonials'] }
)
