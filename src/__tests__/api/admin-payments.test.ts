import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/admin/payments/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }

function mockSupabase(payments: Record<string, unknown>[]) {
  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'payment_logs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          gt: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: payments, error: null }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'courses') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {}
    }),
  } as any)
}

describe('GET /api/admin/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await GET(new Request('http://localhost/api/admin/payments'))
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns empty items and null nextCursor when no payments', async () => {
    mockSupabase([])
    const res = await GET(new Request('http://localhost/api/admin/payments'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toEqual([])
    expect(data.nextCursor).toBeNull()
  })

  it('returns payments enriched with student_name and course_title', async () => {
    mockSupabase([{ id: 1, user_id: 'u1', course_id: 1, amount: 799, status: 'created' }])
    const res = await GET(new Request('http://localhost/api/admin/payments'))
    const data = await res.json()
    // profiles/courses mocked as empty → defaults to '—'
    expect(data.items[0].student_name).toBe('—')
    expect(data.items[0].course_title).toBe('—')
  })

  it('sets nextCursor when there are more results than limit', async () => {
    const payments = Array.from({ length: 3 }, (_, i) => ({
      id: i + 1,
      user_id: `u${i + 1}`,
      course_id: 1,
      amount: 799,
      status: 'created',
    }))
    mockSupabase(payments)
    const res = await GET(new Request('http://localhost/api/admin/payments?limit=2'))
    const data = await res.json()
    expect(data.nextCursor).not.toBeNull()
    expect(data.items).toHaveLength(2)
  })
})
