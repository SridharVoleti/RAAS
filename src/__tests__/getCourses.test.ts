import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCourses,
  getCourseBySlug,
  getCourseById,
  getCoursesCount,
  invalidateCoursesCache,
  getCoursesCacheKey,
} from '@/lib/getCourses'
import type { Course } from '@/types'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

const mockSupabaseClient = {
  from: vi.fn((table: string) => {
    if (table === 'courses') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
      }
    }
    return {}
  }),
}

describe('getCourses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCoursesCache()
  })

  it('should return courses from database when available', async () => {
    const dbRows = [
      {
        id: 1,
        path_id: 1,
        slug: 'test-course',
        emoji: '📖',
        bg_color: '#1a0f00',
        title_en: 'Test Course',
        title_te: 'టెస్ట్ కోర్సు',
        description_en: 'Test',
        description_te: 'టెస్ట్',
        instructor_en: 'Test Instructor',
        instructor_te: 'టెస్ట్ ఇన్ స్ట్రక్టర్',
        category: 'Test',
        level: 'Beginner',
        badge: 'New',
        duration: '4 weeks',
        is_free: false,
        price: 999,
        rating: 4.5,
        review_count: 10,
        student_count: 100,
        has_quiz: false,
        order_index: 1,
        is_published: true,
        lessons: [{ id: 1 }],
      },
    ]
    const { lessons: _lessons, ...expectedCourse } = dbRows[0]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: dbRows, error: null }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    const result = await getCourses()
    expect(result).toEqual([expectedCourse])
  })

  it('marks a course with no lessons as Coming Soon, overriding any badge an admin picked', async () => {
    const dbRows = [
      {
        id: 2,
        path_id: 1,
        slug: 'empty-course',
        emoji: '📖',
        bg_color: '#1a0f00',
        title_en: 'Empty Course',
        title_te: 'టెస్ట్',
        description_en: 'Test',
        description_te: 'టెస్ట్',
        instructor_en: 'Test',
        instructor_te: 'టెస్ట్',
        category: 'Test',
        level: 'Beginner',
        badge: 'Popular', // admin picked a badge, but there are no lessons yet
        duration: '4 weeks',
        is_free: false,
        price: 999,
        rating: 4.5,
        review_count: 10,
        student_count: 100,
        has_quiz: false,
        order_index: 1,
        is_published: true,
        lessons: [],
      },
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: dbRows, error: null }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    const result = await getCourses()
    expect(result[0].badge).toBe('Coming Soon')
  })

  it('should apply limit and offset for pagination', async () => {
    const mockCourses: Course[] = []
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockCourses, error: null }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    await getCourses({ limit: 10, offset: 20 })

    expect(mockQuery.range).toHaveBeenCalledWith(20, 29)
  })

  it('should limit max pagination to 100', async () => {
    const mockCourses: Course[] = []
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockCourses, error: null }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    await getCourses({ limit: 200 }) // Request 200, should be capped at 100

    expect(mockQuery.range).toHaveBeenCalledWith(0, 99)
  })

  it('should cache results and return cached data on second call', async () => {
    const dbRows = [
      {
        id: 1,
        path_id: 1,
        slug: 'test',
        emoji: '📖',
        bg_color: '#000',
        title_en: 'Test',
        title_te: 'టెస్ట్',
        description_en: 'Test',
        description_te: 'టెస్ట్',
        instructor_en: 'Test',
        instructor_te: 'టెస్ట్',
        category: 'Test',
        level: 'Beginner',
        badge: 'New',
        duration: '4 weeks',
        is_free: false,
        price: 999,
        rating: 4.5,
        review_count: 10,
        student_count: 100,
        has_quiz: false,
        order_index: 1,
        is_published: true,
        lessons: [{ id: 1 }],
      },
    ]
    const { lessons: _lessons, ...expectedCourse } = dbRows[0]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: dbRows, error: null }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    const result1 = await getCourses()
    expect(result1).toEqual([expectedCourse])

    // Second call should use cache
    const result2 = await getCourses()
    expect(result2).toEqual([expectedCourse])
    expect(result1 === result2).toBe(true) // Same reference from cache

    // Should only call database once
    expect(mockQuery.range).toHaveBeenCalledTimes(1)
  })

  it('should fall back to seed data if database fails', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    const result = await getCourses()
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('should filter by pathId', async () => {
    const mockCourses: Course[] = []
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockCourses, error: null }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    await getCourses({ pathId: 1 })

    const eqCalls = mockQuery.eq.mock.calls
    expect(eqCalls.some((call: unknown[]) => call[0] === 'path_id' && call[1] === 1)).toBe(true)
  })
})

describe('getCourseBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCoursesCache()
  })

  it('should fetch course by slug', async () => {
    const mockCourse: Course = {
      id: 1,
      path_id: 1,
      slug: 'test-course',
      emoji: '📖',
      bg_color: '#1a0f00',
      title_en: 'Test Course',
      title_te: 'టెస్ట్',
      description_en: 'Test',
      description_te: 'టెస్ట్',
      instructor_en: 'Test',
      instructor_te: 'టెస్ట్',
      category: 'Test',
      level: 'Beginner',
      badge: 'New',
      duration: '4 weeks',
      is_free: false,
      price: 999,
      rating: 4.5,
      review_count: 10,
      student_count: 100,
      has_quiz: false,
      order_index: 1,
      is_published: true,
    }

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    const result = await getCourseBySlug('test-course')
    expect(result).toEqual(mockCourse)
  })

  it('should return null if course not found', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    const result = await getCourseBySlug('nonexistent')
    expect(result).toBeNull()
  })
})

describe('getCourseById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateCoursesCache()
  })

  it('should fetch course by ID', async () => {
    const mockCourse: Course = {
      id: 1,
      path_id: 1,
      slug: 'test',
      emoji: '📖',
      bg_color: '#000',
      title_en: 'Test',
      title_te: 'టెస్ట్',
      description_en: 'Test',
      description_te: 'టెస్ట్',
      instructor_en: 'Test',
      instructor_te: 'టెస్ట్',
      category: 'Test',
      level: 'Beginner',
      badge: 'New',
      duration: '4 weeks',
      is_free: false,
      price: 999,
      rating: 4.5,
      review_count: 10,
      student_count: 100,
      has_quiz: false,
      order_index: 1,
      is_published: true,
    }

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockCourse, error: null }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    const result = await getCourseById(1)
    expect(result).toEqual(mockCourse)
  })
})

describe('getCoursesCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return count of courses', async () => {
    // getCoursesCount chains .select().eq(), so the builder must be thenable
    const resolved = { count: 20, error: null }
    const mockBuilder: Record<string, unknown> = {
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      then:   (onFulfilled: (v: unknown) => unknown) =>
                Promise.resolve(resolved).then(onFulfilled),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockBuilder as any)

    const result = await getCoursesCount()
    expect(result).toBe(20)
  })
})

describe('Cache utilities', () => {
  it('should generate cache key', () => {
    const key1 = getCoursesCacheKey()
    expect(key1).toBe('all_courses')

    const key2 = getCoursesCacheKey({ pathId: 1 })
    expect(key2).toContain('courses_')
  })

  it('should invalidate cache', async () => {
    const mockCourses: Course[] = [
      {
        id: 1,
        path_id: 1,
        slug: 'test',
        emoji: '📖',
        bg_color: '#000',
        title_en: 'Test',
        title_te: 'టెస్ట్',
        description_en: 'Test',
        description_te: 'టెస్ట్',
        instructor_en: 'Test',
        instructor_te: 'టెస్ట్',
        category: 'Test',
        level: 'Beginner',
        badge: 'New',
        duration: '4 weeks',
        is_free: false,
        price: 999,
        rating: 4.5,
        review_count: 10,
        student_count: 100,
        has_quiz: false,
        order_index: 1,
        is_published: true,
      },
    ]

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: mockCourses, error: null }),
    }

    vi.mocked(mockSupabaseClient.from).mockReturnValue(mockQuery as any)

    await getCourses()
    invalidateCoursesCache()

    // After invalidation, next call should hit DB again
    const callCountBefore = mockQuery.range.mock.calls.length
    await getCourses()
    expect(mockQuery.range.mock.calls.length).toBe(callCountBefore + 1)
  })
})
