import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT } from '@/app/api/admin/students/[id]/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }

function mockSupabase(updateError: { code?: string; message?: string } | null = null) {
  const eq = vi.fn().mockResolvedValue({ error: updateError })
  const update = vi.fn().mockReturnValue({ eq })
  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn(() => ({ update })),
  } as any)
  return { update, eq }
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/students/u1', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('PUT /api/admin/students/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await PUT(makeRequest({ country: 'United States' }), { params: Promise.resolve({ id: 'u1' }) })
    expect(forbidden).toHaveBeenCalled()
  })

  it('updates a student profile successfully', async () => {
    const { update } = mockSupabase(null)
    const res = await PUT(
      makeRequest({ country: 'United States', city: 'Austin' }),
      { params: Promise.resolve({ id: 'u1' }) }
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ country: 'United States', city: 'Austin' }))
  })

  it('rejects invalid body with 400', async () => {
    mockSupabase(null)
    const res = await PUT(
      makeRequest({ student_id: -5 }),
      { params: Promise.resolve({ id: 'u1' }) }
    )
    expect(res.status).toBe(400)
  })

  it('returns 409 on unique constraint violation', async () => {
    mockSupabase({ code: '23505', message: 'duplicate key value violates unique constraint "idx_profiles_username"' })
    const res = await PUT(
      makeRequest({ username: 'taken' }),
      { params: Promise.resolve({ id: 'u1' }) }
    )
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toMatch(/Username/)
  })

  it('recomputes avatar_initials when full_name changes', async () => {
    const { update } = mockSupabase(null)
    await PUT(
      makeRequest({ full_name: 'Arjuna Kumar' }),
      { params: Promise.resolve({ id: 'u1' }) }
    )
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ avatar_initials: expect.any(String) }))
  })
})
