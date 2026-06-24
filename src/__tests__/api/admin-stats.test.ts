import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/admin/stats/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }

function mockSupabase(
  totalCourses: number,
  totalStudents: number,
  revenueRows: { amount: number }[],
  pendingCount: number,
  registeredStudents = 0,
  studentsThisYear = 0,
  studentsThisMonth = 0
) {
  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ count: totalCourses }),
        }
      }
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ count: totalStudents }),
        }
      }
      if (table === 'payment_logs') {
        return {
          select: vi.fn((cols: string) => ({
            eq: vi.fn().mockResolvedValue(
              cols === 'amount'
                ? { data: revenueRows }
                : { count: pendingCount }
            ),
          })),
        }
      }
      if (table === 'profiles') {
        // Supports chained .eq().eq() and .eq().gte() patterns
        let callIdx = 0
        const counts = [registeredStudents, studentsThisYear, studentsThisMonth]
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockImplementation(() => ({ count: counts[Math.min(callIdx++, counts.length - 1)] })),
          then: undefined as unknown,
          // For the plain .eq().eq() call (no .gte) resolve directly
          mockResolvedValue: undefined,
        }
      }
      return {}
    }),
  } as any)
}

// Simpler mock that returns correct counts for all profiles queries
function mockSupabaseSimple(
  totalCourses: number,
  totalStudents: number,
  revenueRows: { amount: number }[],
  pendingCount: number
) {
  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'courses') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ count: totalCourses }) }
      }
      if (table === 'enrollments') {
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ count: totalStudents }) }
      }
      if (table === 'payment_logs') {
        return {
          select: vi.fn((cols: string) => ({
            eq: vi.fn().mockResolvedValue(cols === 'amount' ? { data: revenueRows } : { count: pendingCount }),
          })),
        }
      }
      if (table === 'profiles') {
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockResolvedValue({ count: 0 }),
          then: undefined,
        }
        // Make .eq chain terminal too
        chain.eq = vi.fn().mockReturnValue({ ...chain, count: 0 })
        return chain
      }
      return {}
    }),
  } as any)
}

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await GET()
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns all-zeros when no data exists', async () => {
    mockSupabaseSimple(0, 0, [], 0)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.totalCourses).toBe(0)
    expect(data.totalStudents).toBe(0)
    expect(data.totalRevenue).toBe(0)
    expect(data.pendingPayments).toBe(0)
  })

  it('sums revenue correctly from payment_logs', async () => {
    mockSupabaseSimple(5, 10, [{ amount: 799 }, { amount: 1499 }], 3)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.totalRevenue).toBe(2298)
    expect(data.totalCourses).toBe(5)
    expect(data.totalStudents).toBe(10)
    expect(data.pendingPayments).toBe(3)
  })
})
