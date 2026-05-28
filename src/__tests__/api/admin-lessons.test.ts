import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/admin/courses/[id]/lessons/route'
import { PUT, DELETE } from '@/app/api/admin/lessons/[id]/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }
const courseParams = { params: Promise.resolve({ id: '1' }) }
const lessonParams = { params: Promise.resolve({ id: '5' }) }

const validLessonBody = {
  title_en: 'Lesson One',
  youtube_video_id: 'dQw4w9WgXcQ',
  order_index: 1,
}

function makeRequest(body: unknown, method = 'POST') {
  return new Request('http://localhost/', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── GET lessons ──────────────────────────────────────────────────────────────

describe('GET /api/admin/courses/[id]/lessons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await GET(new Request('http://localhost/'), courseParams)
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns lessons ordered by order_index', async () => {
    const lessons = [{ id: 1, title_en: 'L1', order_index: 1 }, { id: 2, title_en: 'L2', order_index: 2 }]
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: lessons, error: null }),
      }),
    } as any)

    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(2)
  })

  it('returns empty array when course has no lessons', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    } as any)

    const res = await GET(new Request('http://localhost/'), courseParams)
    const data = await res.json()
    expect(data).toEqual([])
  })
})

// ── POST lesson ──────────────────────────────────────────────────────────────

describe('POST /api/admin/courses/[id]/lessons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 400 for invalid body', async () => {
    const res = await POST(makeRequest({ title_en: 'x' }), courseParams)
    expect(res.status).toBe(400)
  })

  it('creates lesson and returns 201', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1, ...validLessonBody }, error: null }),
      }),
    } as any)

    const res = await POST(makeRequest(validLessonBody), courseParams)
    expect(res.status).toBe(201)
  })
})

// ── PUT lesson ───────────────────────────────────────────────────────────────

describe('PUT /api/admin/lessons/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 400 when order_index is missing (required by UpdateLessonSchema)', async () => {
    const res = await PUT(makeRequest({ title_en: 'Updated', youtube_video_id: 'abc12' }, 'PUT'), lessonParams)
    expect(res.status).toBe(400)
  })

  it('updates lesson and returns 200', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 5, ...validLessonBody }, error: null }),
      }),
    } as any)

    const res = await PUT(makeRequest(validLessonBody, 'PUT'), lessonParams)
    expect(res.status).toBe(200)
  })
})

// ── DELETE lesson ────────────────────────────────────────────────────────────

describe('DELETE /api/admin/lessons/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await DELETE(new Request('http://localhost/', { method: 'DELETE' }), lessonParams)
    expect(forbidden).toHaveBeenCalled()
  })

  it('deletes lesson and returns 200', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as any)

    const res = await DELETE(new Request('http://localhost/', { method: 'DELETE' }), lessonParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
