import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/notes/[courseId]/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'

const courseParams = { params: Promise.resolve({ courseId: '1' }) }

function mockSupabase(user: { id: string } | null, noteContent: string | null = null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: noteContent ? { content: noteContent } : null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as any)
}

// ── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/notes/[courseId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase(null)
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(401)
  })

  it('returns note content for authenticated user', async () => {
    mockSupabase({ id: 'u1' }, 'My notes here')
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.content).toBe('My notes here')
  })

  it('returns empty string when no note exists', async () => {
    mockSupabase({ id: 'u1' }, null)
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.content).toBe('')
  })
})

// ── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/notes/[courseId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makePostRequest(body: unknown) {
    return new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase(null)
    const res = await POST(makePostRequest({ content: 'notes' }), courseParams)
    expect(res.status).toBe(401)
  })

  it('saves note and returns success', async () => {
    mockSupabase({ id: 'u1' })
    const res = await POST(makePostRequest({ content: 'My updated notes' }), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('returns 500 when request body is not valid JSON', async () => {
    mockSupabase({ id: 'u1' })
    const badReq = new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    const res = await POST(badReq, courseParams)
    expect(res.status).toBe(500)
  })
})
