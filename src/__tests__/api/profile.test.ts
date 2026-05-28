import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT, PATCH } from '@/app/api/profile/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createClient } from '@/lib/supabase/server'

const mockProfile = {
  id: 'user-1',
  full_name: 'Arjuna Kumar',
  avatar_initials: 'AK',
  mobile: '9876543210',
  isd_code: '+91',
  city: 'Hyderabad',
  country: 'India',
  preferred_lang: 'en',
  profile_complete: true,
}

function mockSupabase(user: { id: string; email: string } | null, profileData: typeof mockProfile | null = mockProfile, updateError = false) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
      updateUser: vi.fn().mockResolvedValue({ error: updateError ? { message: 'Auth error' } : null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: profileData, error: profileData ? null : { message: 'not found' } }),
      update: vi.fn().mockReturnThis(),
    }),
  } as any)
}

function makeRequest(method: string, body?: unknown) {
  return new Request('http://localhost/api/profile', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// ── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/profile', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns profile data with email for authenticated user', async () => {
    mockSupabase({ id: 'user-1', email: 'arjuna@example.com' })
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.full_name).toBe('Arjuna Kumar')
    expect(data.email).toBe('arjuna@example.com')
    expect(data.city).toBe('Hyderabad')
  })

  it('returns 404 when profile does not exist', async () => {
    mockSupabase({ id: 'user-1', email: 'x@x.com' }, null)
    const res = await GET()
    expect(res.status).toBe(404)
  })
})

// ── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/profile', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null)
    const res = await PUT(makeRequest('PUT', { full_name: 'New Name' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body (name too short)', async () => {
    mockSupabase({ id: 'user-1', email: 'x@x.com' })
    const res = await PUT(makeRequest('PUT', { full_name: 'X' }))
    expect(res.status).toBe(400)
  })

  it('updates profile and returns 200', async () => {
    mockSupabase({ id: 'user-1', email: 'x@x.com' })
    const res = await PUT(makeRequest('PUT', { full_name: 'Arjuna Dev', city: 'Chennai' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('recomputes avatar_initials when full_name is updated', async () => {
    let capturedUpdates: Record<string, unknown> = {}
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'x@x.com' } } }) },
      from: vi.fn().mockReturnValue({
        update: vi.fn((data: Record<string, unknown>) => { capturedUpdates = data; return { eq: vi.fn().mockResolvedValue({ error: null }) } }),
      }),
    } as any)

    await PUT(makeRequest('PUT', { full_name: 'Arjuna Dev' }))
    expect(capturedUpdates.avatar_initials).toBe('AD')
  })

  it('accepts empty update (all fields optional)', async () => {
    mockSupabase({ id: 'user-1', email: 'x@x.com' })
    const res = await PUT(makeRequest('PUT', {}))
    expect(res.status).toBe(200)
  })
})

// ── PATCH (password change) ───────────────────────────────────────────────────

describe('PATCH /api/profile (password change)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null)
    const res = await PATCH(makeRequest('PATCH', { password: 'newPassword123' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for password shorter than 8 characters', async () => {
    mockSupabase({ id: 'user-1', email: 'x@x.com' })
    const res = await PATCH(makeRequest('PATCH', { password: 'short' }))
    expect(res.status).toBe(400)
  })

  it('changes password and returns 200', async () => {
    mockSupabase({ id: 'user-1', email: 'x@x.com' })
    const res = await PATCH(makeRequest('PATCH', { password: 'strongPassword123' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('returns 400 when auth updateUser fails', async () => {
    mockSupabase({ id: 'user-1', email: 'x@x.com' }, mockProfile, true)
    const res = await PATCH(makeRequest('PATCH', { password: 'strongPassword123' }))
    expect(res.status).toBe(400)
  })
})
