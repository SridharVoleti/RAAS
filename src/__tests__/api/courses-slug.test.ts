import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/courses/[slug]/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

function makeRequest(slug: string) {
  return new Request(`http://localhost/api/courses/${slug}`)
}

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) }
}

function mockSupabase(course: Record<string, unknown> | null, dbError = false) {
  vi.mocked(createClient).mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(
        dbError
          ? { data: null, error: { message: 'not found' } }
          : { data: course, error: null }
      ),
    }),
  } as any)
}

describe('GET /api/courses/[slug]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when course is not found', async () => {
    mockSupabase(null, true)
    const res = await GET(makeRequest('nonexistent'), makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('not found')
  })

  it('returns course data for a published course', async () => {
    mockSupabase({
      id: 1,
      slug: 'intro-vedanta',
      title_en: 'Intro to Vedanta',
      is_published: true,
      lessons: [],
    })
    const res = await GET(makeRequest('intro-vedanta'), makeParams('intro-vedanta'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.slug).toBe('intro-vedanta')
  })

  it('strips youtube_video_id from all lessons', async () => {
    mockSupabase({
      id: 1,
      slug: 'test-course',
      is_published: true,
      lessons: [
        { id: 1, title_en: 'Lesson 1', youtube_video_id: 'secret123', order_index: 1 },
        { id: 2, title_en: 'Lesson 2', youtube_video_id: 'secret456', order_index: 2 },
      ],
    })
    const res = await GET(makeRequest('test-course'), makeParams('test-course'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.lessons).toHaveLength(2)
    for (const lesson of data.lessons) {
      expect(lesson).not.toHaveProperty('youtube_video_id')
      expect(lesson).toHaveProperty('title_en')
    }
  })

  it('returns course with empty lessons array when no lessons', async () => {
    mockSupabase({ id: 1, slug: 'empty-course', is_published: true, lessons: [] })
    const res = await GET(makeRequest('empty-course'), makeParams('empty-course'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.lessons).toEqual([])
  })
})
