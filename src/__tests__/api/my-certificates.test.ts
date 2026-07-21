import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/my-certificates/route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/certificate', () => ({
  getCertificate: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createClient } from '@/lib/supabase/server'
import { getCertificate } from '@/lib/certificate'

function mockUserClient(enrollments: { course_id: number }[] | null, user: { id: string } | null = { id: 'u1' }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => {
      const b: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in']) b[m] = vi.fn().mockReturnValue(b)
      b.then = (resolve: (v: unknown) => void) => resolve({ data: enrollments })
      return b
    }),
  } as any)
}

describe('GET /api/my-certificates', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when not logged in', async () => {
    mockUserClient([], null)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns only earned certificates, newest first', async () => {
    mockUserClient([{ course_id: 1 }, { course_id: 2 }, { course_id: 3 }])
    vi.mocked(getCertificate).mockImplementation(async (courseId: number) => {
      if (courseId === 2) return { ok: false, status: 403, error: 'Course not yet completed' }
      return {
        ok: true,
        data: {
          studentName: 'Arjuna Kumar',
          courseTitle: `Course ${courseId}`,
          courseTitleTe: null,
          completedAt: courseId === 1 ? '2024-06-01T10:00:00Z' : '2024-07-01T10:00:00Z',
          emoji: '🪷',
          courseId,
          examScore: null,
        },
      }
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.certificates).toHaveLength(2)
    expect(data.certificates.map((c: { courseId: number }) => c.courseId)).toEqual([3, 1])
  })

  it('returns an empty list when nothing is completed', async () => {
    mockUserClient([{ course_id: 1 }])
    vi.mocked(getCertificate).mockResolvedValue({ ok: false, status: 403, error: 'Course not yet completed' })
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.certificates).toEqual([])
  })

  it('returns an empty list for a student with no enrollments', async () => {
    mockUserClient(null)
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.certificates).toEqual([])
  })
})
