import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/admin/payments/[id]/confirm/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEnrollmentEmail: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }
const idParams = { params: Promise.resolve({ id: '42' }) }

function mockSupabase(payment: Record<string, unknown> | null, fetchError = false) {
  const updateBuilder = { eq: vi.fn().mockResolvedValue({ error: null }) }
  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'payment_logs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(
            fetchError
              ? { data: null, error: { message: 'not found' } }
              : { data: payment, error: null }
          ),
          update: vi.fn().mockReturnValue(updateBuilder),
        }
      }
      return { upsert: vi.fn().mockResolvedValue({ error: null }) }
    }),
  } as any)
}

describe('POST /api/admin/payments/[id]/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await POST(new Request('http://localhost/', { method: 'POST' }), idParams)
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns 404 when payment is not found', async () => {
    mockSupabase(null, true)
    const res = await POST(new Request('http://localhost/', { method: 'POST' }), idParams)
    expect(res.status).toBe(404)
  })

  it('returns 400 when payment is already confirmed', async () => {
    mockSupabase({ user_id: 'u1', course_id: 1, status: 'paid' })
    const res = await POST(new Request('http://localhost/', { method: 'POST' }), idParams)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Already confirmed')
  })

  it('confirms payment and returns 200', async () => {
    mockSupabase({ user_id: 'u1', course_id: 1, status: 'created' })
    const res = await POST(new Request('http://localhost/', { method: 'POST' }), idParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
