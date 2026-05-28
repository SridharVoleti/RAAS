import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/admin/bootstrap/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'

const SETUP_SECRET = 'super-secret-setup'

function makeRequest(body: unknown, authHeader?: string) {
  return new Request('http://localhost/api/admin/bootstrap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authHeader ? { authorization: authHeader } : {}),
    },
    body: JSON.stringify(body),
  })
}

function mockSupabase(users: { id: string; email: string }[]) {
  vi.mocked(createAdminClient).mockResolvedValue({
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users }, error: null }),
      },
    },
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as any)
}

describe('POST /api/admin/bootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_SETUP_SECRET = SETUP_SECRET
  })

  it('returns 500 when ADMIN_SETUP_SECRET is not configured', async () => {
    delete process.env.ADMIN_SETUP_SECRET
    const res = await POST(makeRequest({ email: 'test@example.com' }, `Bearer ${SETUP_SECRET}`))
    expect(res.status).toBe(500)
  })

  it('returns 401 when authorization header is missing', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when bearer token is wrong', async () => {
    const res = await POST(makeRequest({ email: 'test@example.com' }, 'Bearer wrong-token'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when email is missing', async () => {
    mockSupabase([])
    const res = await POST(makeRequest({ email: '' }, `Bearer ${SETUP_SECRET}`))
    expect(res.status).toBe(400)
  })

  it('returns 404 when user email is not found', async () => {
    mockSupabase([{ id: 'other-id', email: 'other@example.com' }])
    const res = await POST(makeRequest({ email: 'notfound@example.com' }, `Bearer ${SETUP_SECRET}`))
    expect(res.status).toBe(404)
  })

  it('promotes user to admin and returns 200', async () => {
    mockSupabase([{ id: 'user-1', email: 'admin@example.com' }])
    const res = await POST(makeRequest({ email: 'admin@example.com' }, `Bearer ${SETUP_SECRET}`))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })

  it('is case-insensitive for email lookup', async () => {
    mockSupabase([{ id: 'user-1', email: 'Admin@Example.COM' }])
    const res = await POST(makeRequest({ email: 'admin@example.com' }, `Bearer ${SETUP_SECRET}`))
    expect(res.status).toBe(200)
  })
})
