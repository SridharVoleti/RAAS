import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT } from '@/app/api/admin/students/[id]/reset-password/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }

function mockSupabase(updateError: { message?: string } | null = null) {
  const updateUserById = vi.fn().mockResolvedValue({ error: updateError })
  vi.mocked(createAdminClient).mockResolvedValue({
    auth: { admin: { updateUserById } },
  } as any)
  return { updateUserById }
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/students/u1/reset-password', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('PUT /api/admin/students/[id]/reset-password', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await PUT(makeRequest({ password: 'Str0ng!Pass' }), { params: Promise.resolve({ id: 'u1' }) })
    expect(forbidden).toHaveBeenCalled()
  })

  it('resets the password successfully', async () => {
    const { updateUserById } = mockSupabase(null)
    const res = await PUT(makeRequest({ password: 'Str0ng!Pass' }), { params: Promise.resolve({ id: 'u1' }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(updateUserById).toHaveBeenCalledWith('u1', { password: 'Str0ng!Pass' })
  })

  it('rejects a password missing an uppercase letter', async () => {
    mockSupabase(null)
    const res = await PUT(makeRequest({ password: 'weak!123' }), { params: Promise.resolve({ id: 'u1' }) })
    expect(res.status).toBe(400)
  })

  it('rejects a password missing a special character', async () => {
    mockSupabase(null)
    const res = await PUT(makeRequest({ password: 'WeakPass1' }), { params: Promise.resolve({ id: 'u1' }) })
    expect(res.status).toBe(400)
  })

  it('rejects a password shorter than 8 characters', async () => {
    mockSupabase(null)
    const res = await PUT(makeRequest({ password: 'W1!ab' }), { params: Promise.resolve({ id: 'u1' }) })
    expect(res.status).toBe(400)
  })

  it('returns 500 when Supabase update fails', async () => {
    mockSupabase({ message: 'unexpected error' })
    const res = await PUT(makeRequest({ password: 'Str0ng!Pass' }), { params: Promise.resolve({ id: 'u1' }) })
    expect(res.status).toBe(500)
  })
})
