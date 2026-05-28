import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/admin/courses/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }

const validCourseBody = {
  path_id: 1,
  slug: 'my-course',
  title_en: 'My Course',
  title_te: 'నా కోర్సు',
  description_en: 'A detailed description here',
  description_te: 'వివరణ ఇక్కడ ఉంది అయినా',
  instructor_en: 'Instructor',
  instructor_te: 'ఉపాధ్యాయుడు',
  category: 'Vedic',
  level: 'Beginner',
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost/api/admin/courses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await GET()
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns courses list with lesson_count', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 1, title_en: 'Course A', lessons: [{ id: 1 }, { id: 2 }] }],
          error: null,
        }),
      }),
    } as any)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data[0].lesson_count).toBe(2)
    expect(data[0]).not.toHaveProperty('lessons')
  })

  it('returns empty array when no courses', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as any)

    const res = await GET()
    const data = await res.json()
    expect(data).toEqual([])
  })
})

describe('POST /api/admin/courses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await POST(makePostRequest(validCourseBody))
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns 400 for invalid body', async () => {
    const res = await POST(makePostRequest({ slug: 'only-slug' }))
    expect(res.status).toBe(400)
  })

  it('creates course and returns 201', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1, ...validCourseBody }, error: null }),
      }),
    } as any)

    const res = await POST(makePostRequest(validCourseBody))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.slug).toBe('my-course')
  })

  it('forces price to 0 when is_free is true', async () => {
    let insertedData: Record<string, unknown> = {}
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn((row: Record<string, unknown>) => {
          insertedData = row
          return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: row, error: null }) }
        }),
      }),
    } as any)

    await POST(makePostRequest({ ...validCourseBody, is_free: true, price: 999 }))
    expect(insertedData.price).toBe(0)
  })
})
