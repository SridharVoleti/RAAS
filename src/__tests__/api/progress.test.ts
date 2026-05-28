import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/progress/[courseId]/route'
import { POST } from '@/app/api/progress/[courseId]/lesson/[lessonId]/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

function mockUserSupabase(user: { id: string } | null, progressData: unknown[] = []) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
    // Resolved via the final awaited call
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: progressData, error: null }).then(resolve),
  } as any)
}

// ── GET /api/progress/[courseId] ─────────────────────────────────────────────

describe('GET /api/progress/[courseId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockGetSupabase(user: { id: string } | null, data: unknown[] = []) {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(resolve),
      }),
    } as any)
  }

  it('returns 401 when user is not authenticated', async () => {
    mockGetSupabase(null)
    const res = await GET(
      new Request('http://localhost/'),
      { params: Promise.resolve({ courseId: '1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns progress array for authenticated user', async () => {
    const progress = [{ lesson_id: 1, completed_at: '2024-01-01T00:00:00Z' }]
    mockGetSupabase({ id: 'u1' }, progress)
    const res = await GET(
      new Request('http://localhost/'),
      { params: Promise.resolve({ courseId: '1' }) }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].lesson_id).toBe(1)
  })

  it('returns empty array when user has no progress', async () => {
    mockGetSupabase({ id: 'u1' }, [])
    const res = await GET(
      new Request('http://localhost/'),
      { params: Promise.resolve({ courseId: '1' }) }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual([])
  })
})

// ── POST /api/progress/[courseId]/lesson/[lessonId] ──────────────────────────

describe('POST /api/progress/[courseId]/lesson/[lessonId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockPostSupabase(user: { id: string } | null, upsertError = false) {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: upsertError ? { message: 'err' } : null }),
      }),
    } as any)
  }

  it('returns 401 when user is not authenticated', async () => {
    mockPostSupabase(null)
    const res = await POST(
      new Request('http://localhost/', { method: 'POST' }),
      { params: Promise.resolve({ courseId: '1', lessonId: '2' }) }
    )
    expect(res.status).toBe(401)
  })

  it('marks lesson as complete and returns 200', async () => {
    mockPostSupabase({ id: 'u1' })
    const res = await POST(
      new Request('http://localhost/', { method: 'POST' }),
      { params: Promise.resolve({ courseId: '1', lessonId: '2' }) }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('is idempotent (ignoreDuplicates) — does not error on repeat', async () => {
    mockPostSupabase({ id: 'u1' })
    const params = { params: Promise.resolve({ courseId: '1', lessonId: '2' }) }
    const req = () => new Request('http://localhost/', { method: 'POST' })
    const res1 = await POST(req(), params)
    const res2 = await POST(req(), params)
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
  })
})
