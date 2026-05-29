import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/admin/analytics/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }

function mockSupabase(
  courses: Record<string, unknown>[],
  enrollments: Record<string, unknown>[],
  payments: Record<string, unknown>[],
  progress: Record<string, unknown>[]
) {
  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      const resultMap: Record<string, unknown[]> = {
        courses: courses,
        enrollments: enrollments,
        payment_logs: payments,
        user_progress: progress,
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve({ data: resultMap[table] ?? [], error: null }).then(resolve),
      }
    }),
  } as any)
}

describe('GET /api/admin/analytics', () => {
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

  it('returns empty stats when no data exists', async () => {
    mockSupabase([], [], [], [])
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.courseStats).toEqual([])
    expect(data.monthlyTrend).toHaveLength(6)
    expect(data.totals.courses).toBe(0)
    expect(data.totals.enrollments).toBe(0)
    expect(data.totals.revenue).toBe(0)
    expect(data.totals.lessonCompletions).toBe(0)
  })

  it('returns correct enrollment count per course', async () => {
    const courses = [{ id: 1, title_en: 'Course A', emoji: '📖', bg_color: '#1a0f00', is_published: true }]
    const enrollments = [
      { course_id: 1, enrolled_at: new Date().toISOString(), is_active: true },
      { course_id: 1, enrolled_at: new Date().toISOString(), is_active: true },
    ]
    mockSupabase(courses, enrollments, [], [])
    const res = await GET()
    const data = await res.json()
    expect(data.courseStats[0].enrollments).toBe(2)
    expect(data.totals.enrollments).toBe(2)
  })

  it('sums revenue per course correctly', async () => {
    const courses = [{ id: 1, title_en: 'Vedanta', emoji: '🪷', bg_color: '#1a0f00', is_published: true }]
    const payments = [
      { course_id: 1, amount: 799, created_at: new Date().toISOString() },
      { course_id: 1, amount: 1499, created_at: new Date().toISOString() },
    ]
    mockSupabase(courses, [], payments, [])
    const res = await GET()
    const data = await res.json()
    expect(data.courseStats[0].revenue).toBe(2298)
    expect(data.totals.revenue).toBe(2298)
  })

  it('returns 6 monthly trend entries', async () => {
    mockSupabase([], [], [], [])
    const res = await GET()
    const data = await res.json()
    expect(data.monthlyTrend).toHaveLength(6)
    for (const m of data.monthlyTrend) {
      expect(m).toHaveProperty('label')
      expect(m).toHaveProperty('count')
    }
  })

  it('counts lesson completions per course', async () => {
    const courses = [{ id: 1, title_en: 'Course A', emoji: '📖', bg_color: '#000', is_published: true }]
    const progress = [
      { course_id: 1, completed_at: '2024-01-01' },
      { course_id: 1, completed_at: '2024-01-02' },
      { course_id: 1, completed_at: '2024-01-03' },
    ]
    mockSupabase(courses, [], [], progress)
    const res = await GET()
    const data = await res.json()
    expect(data.completionsBycourse[0].completions).toBe(3)
    expect(data.totals.lessonCompletions).toBe(3)
  })

  it('sorts courseStats by enrollments descending', async () => {
    const courses = [
      { id: 1, title_en: 'Low', emoji: '📖', bg_color: '#000', is_published: true },
      { id: 2, title_en: 'High', emoji: '📖', bg_color: '#000', is_published: true },
    ]
    const enrollments = [
      { course_id: 2, enrolled_at: new Date().toISOString(), is_active: true },
      { course_id: 2, enrolled_at: new Date().toISOString(), is_active: true },
      { course_id: 1, enrolled_at: new Date().toISOString(), is_active: true },
    ]
    mockSupabase(courses, enrollments, [], [])
    const res = await GET()
    const data = await res.json()
    expect(data.courseStats[0].title).toBe('High')
    expect(data.courseStats[1].title).toBe('Low')
  })
})
