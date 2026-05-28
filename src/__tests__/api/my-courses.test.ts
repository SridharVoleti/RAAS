import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/my-courses/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

function mockSupabase(user: { id: string } | null, courses: unknown[] = [], dbError = false) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue(
        dbError
          ? { data: null, error: { message: 'view error' } }
          : { data: courses, error: null }
      ),
    }),
  } as any)
}

describe('GET /api/my-courses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns empty array when user has no enrollments', async () => {
    mockSupabase({ id: 'u1' }, [])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })

  it('returns enrolled courses for authenticated user', async () => {
    const courses = [
      { id: 1, title_en: 'Course A', progress: 50 },
      { id: 2, title_en: 'Course B', progress: 0 },
    ]
    mockSupabase({ id: 'u1' }, courses)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
    expect(data[0].title_en).toBe('Course A')
  })

  it('returns 500 when view query fails', async () => {
    mockSupabase({ id: 'u1' }, [], true)
    const res = await GET()
    expect(res.status).toBe(500)
  })
})
