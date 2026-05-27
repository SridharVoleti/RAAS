import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/courses/route'

// Mock dependencies
vi.mock('@/lib/getCourses', () => ({
  getCourses: vi.fn(),
  getCoursesCount: vi.fn(),
}))

import { getCourses, getCoursesCount } from '@/lib/getCourses'
import type { Course } from '@/types'

const mockCourse: Course = {
  id: 1,
  path_id: 1,
  slug: 'test-course',
  emoji: '📖',
  bg_color: '#1a0f00',
  title_en: 'Test Course',
  title_te: 'టెస్ట్ కోర్సు',
  description_en: 'A test course for learning',
  description_te: 'నేర్చుకోవడం కోసం ఒక టెస్ట్ కోర్సు',
  instructor_en: 'Test Instructor',
  instructor_te: 'టెస్ట్ ఇన్‌స్ట్రక్టర్',
  category: 'Test',
  level: 'Beginner',
  badge: 'New',
  duration: '4 weeks',
  is_free: false,
  price: 799,
  rating: 4.8,
  review_count: 234,
  student_count: 1847,
  has_quiz: false,
  order_index: 1,
  is_published: true,
}

describe('GET /api/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return courses with pagination metadata', async () => {
    vi.mocked(getCourses).mockResolvedValue([mockCourse])
    vi.mocked(getCoursesCount).mockResolvedValue(1)

    const request = new Request('http://localhost:3000/api/courses')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data).toHaveProperty('items')
    expect(data).toHaveProperty('total')
    expect(data).toHaveProperty('limit')
    expect(data).toHaveProperty('offset')
    expect(data).toHaveProperty('hasMore')
    expect(data.items).toEqual([mockCourse])
    expect(data.total).toBe(1)
  })

  it('should respect limit and offset query parameters', async () => {
    vi.mocked(getCourses).mockResolvedValue([mockCourse])
    vi.mocked(getCoursesCount).mockResolvedValue(10)

    const request = new Request('http://localhost:3000/api/courses?limit=5&offset=0')
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()

    expect(data.limit).toBe(5)
    expect(data.offset).toBe(0)
    expect(vi.mocked(getCourses)).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 5,
        offset: 0,
      })
    )
  })

  it('should cap limit at 100', async () => {
    vi.mocked(getCourses).mockResolvedValue([mockCourse])
    vi.mocked(getCoursesCount).mockResolvedValue(1)

    const request = new Request('http://localhost:3000/api/courses?limit=200')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(vi.mocked(getCourses)).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 100, // Should be capped at 100
      })
    )
  })

  it('should include cache headers', async () => {
    vi.mocked(getCourses).mockResolvedValue([mockCourse])
    vi.mocked(getCoursesCount).mockResolvedValue(1)

    const request = new Request('http://localhost:3000/api/courses')
    const response = await GET(request)

    expect(response.headers.get('Cache-Control')).toBe('public, max-age=86400')
    expect(response.headers.get('CDN-Cache-Control')).toBe('max-age=86400')
  })

  it('should calculate hasMore correctly', async () => {
    vi.mocked(getCourses).mockResolvedValue([mockCourse])
    vi.mocked(getCoursesCount).mockResolvedValue(10)

    const request1 = new Request('http://localhost:3000/api/courses?limit=5&offset=0')
    const response1 = await GET(request1)
    const data1 = await response1.json()
    expect(data1.hasMore).toBe(true) // 0 + 5 < 10

    vi.mocked(getCourses).mockResolvedValue([mockCourse])
    const request2 = new Request('http://localhost:3000/api/courses?limit=5&offset=10')
    const response2 = await GET(request2)
    const data2 = await response2.json()
    expect(data2.hasMore).toBe(false) // 10 + 5 >= 10
  })

  it('should handle pathId filter', async () => {
    vi.mocked(getCourses).mockResolvedValue([mockCourse])
    vi.mocked(getCoursesCount).mockResolvedValue(1)

    const request = new Request('http://localhost:3000/api/courses?pathId=1')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(vi.mocked(getCourses)).toHaveBeenCalledWith(
      expect.objectContaining({
        pathId: 1,
      })
    )
  })

  it('should return 500 on error', async () => {
    vi.mocked(getCourses).mockRejectedValue(new Error('DB connection failed'))

    const request = new Request('http://localhost:3000/api/courses')
    const response = await GET(request)

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data).toHaveProperty('error')
    expect(data.error).toBe('Failed to fetch courses')
  })
})

describe('Pagination edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should handle negative offset', async () => {
    vi.mocked(getCourses).mockResolvedValue([mockCourse])
    vi.mocked(getCoursesCount).mockResolvedValue(10)

    const request = new Request('http://localhost:3000/api/courses?offset=-5')
    const response = await GET(request)

    const data = await response.json()
    expect(data.offset).toBe(0) // Negative offsets should be clamped to 0
  })

  it('should handle zero limit', async () => {
    vi.mocked(getCourses).mockResolvedValue([])
    vi.mocked(getCoursesCount).mockResolvedValue(10)

    const request = new Request('http://localhost:3000/api/courses?limit=0')
    const response = await GET(request)

    expect(response.status).toBe(200)
  })

  it('should handle large offset', async () => {
    vi.mocked(getCourses).mockResolvedValue([])
    vi.mocked(getCoursesCount).mockResolvedValue(10)

    const request = new Request('http://localhost:3000/api/courses?offset=1000')
    const response = await GET(request)

    const data = await response.json()
    expect(data.offset).toBe(1000)
    expect(data.hasMore).toBe(false)
  })
})
