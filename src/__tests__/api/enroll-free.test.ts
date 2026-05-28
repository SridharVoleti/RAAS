import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/enroll/free/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEnrollmentEmail: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/enroll/free', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(
  user: { id: string } | null,
  course: { is_free: boolean; price: number } | null,
  upsertError: boolean = false
) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: course, error: null }),
        }
      }
      if (table === 'enrollments') {
        return {
          upsert: vi.fn().mockResolvedValue({
            error: upsertError ? { message: 'DB error' } : null,
          }),
        }
      }
      return {}
    }),
  } as any)
}

describe('POST /api/enroll/free', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid body', async () => {
    mockSupabase({ id: 'u1' }, { is_free: true, price: 0 })
    const req = makeRequest({ courseId: 'bad' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase(null, { is_free: true, price: 0 })
    const req = makeRequest({ courseId: 1 })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when course is not free', async () => {
    mockSupabase({ id: 'u1' }, { is_free: false, price: 799 })
    const req = makeRequest({ courseId: 1 })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('not free')
  })

  it('returns 400 when course does not exist', async () => {
    mockSupabase({ id: 'u1' }, null)
    const req = makeRequest({ courseId: 999 })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('enrolls user in a free course and returns 200', async () => {
    mockSupabase({ id: 'u1' }, { is_free: true, price: 0 })
    const req = makeRequest({ courseId: 1 })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('returns 500 when enrollment upsert fails', async () => {
    mockSupabase({ id: 'u1' }, { is_free: true, price: 0 }, true)
    const req = makeRequest({ courseId: 1 })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
