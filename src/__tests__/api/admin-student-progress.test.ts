import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/admin/analytics/student-progress/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }

function mockSupabase(opts: {
  enrollments?: Record<string, unknown>[]
  courses?: Record<string, unknown>[]
  lessons?: Record<string, unknown>[]
  progress?: Record<string, unknown>[]
  profiles?: Record<string, unknown>[]
  authUsers?: { id: string; email: string }[]
  enrollError?: boolean
}) {
  const {
    enrollments = [],
    courses = [],
    lessons = [],
    progress = [],
    profiles = [],
    authUsers = [],
    enrollError = false,
  } = opts

  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      const resultMap: Record<string, { data: unknown[]; error: unknown }> = {
        enrollments: { data: enrollments, error: enrollError ? { message: 'boom' } : null },
        courses: { data: courses, error: null },
        lessons: { data: lessons, error: null },
        user_progress: { data: progress, error: null },
        profiles: { data: profiles, error: null },
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        then: (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resultMap[table] ?? { data: [], error: null }).then(resolve),
      }
    }),
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: authUsers } }),
      },
    },
  } as any)
}

describe('GET /api/admin/analytics/student-progress', () => {
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

  it('returns empty students when no active enrollments exist', async () => {
    mockSupabase({})
    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.students).toEqual([])
  })

  it('returns 500 when the enrollments query fails', async () => {
    mockSupabase({ enrollError: true })
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('computes completed/total lessons per enrolled course', async () => {
    mockSupabase({
      enrollments: [{ user_id: 'u1', course_id: 1, enrolled_at: '2026-01-01T00:00:00Z' }],
      courses: [{ id: 1, title_en: 'Gita', title_te: 'గీత', emoji: '📖', bg_color: '#000' }],
      lessons: [{ id: 10, course_id: 1 }, { id: 11, course_id: 1 }, { id: 12, course_id: 1 }],
      progress: [{ user_id: 'u1', course_id: 1 }, { user_id: 'u1', course_id: 1 }],
      profiles: [{ id: 'u1', full_name: 'Alice', avatar_initials: 'A', student_id: 1 }],
      authUsers: [{ id: 'u1', email: 'alice@example.com' }],
    })

    const res = await GET()
    const data = await res.json()
    expect(data.students).toHaveLength(1)
    expect(data.students[0]).toMatchObject({ id: 'u1', full_name: 'Alice', email: 'alice@example.com' })
    expect(data.students[0].courses).toEqual([
      expect.objectContaining({
        course_id: 1,
        completed_lessons: 2,
        total_lessons: 3,
        progress_pct: 67,
      }),
    ])
  })

  it('groups multiple courses under the same student', async () => {
    mockSupabase({
      enrollments: [
        { user_id: 'u1', course_id: 1, enrolled_at: '2026-01-01T00:00:00Z' },
        { user_id: 'u1', course_id: 2, enrolled_at: '2026-01-02T00:00:00Z' },
      ],
      courses: [
        { id: 1, title_en: 'Gita', title_te: 'గీత', emoji: '📖', bg_color: '#000' },
        { id: 2, title_en: 'Vedanta', title_te: 'వేదాంత', emoji: '🪷', bg_color: '#111' },
      ],
      lessons: [{ id: 10, course_id: 1 }, { id: 20, course_id: 2 }],
      progress: [],
      profiles: [{ id: 'u1', full_name: 'Alice', avatar_initials: 'A', student_id: 1 }],
    })

    const res = await GET()
    const data = await res.json()
    expect(data.students).toHaveLength(1)
    expect(data.students[0].courses).toHaveLength(2)
  })

  it('defaults name and email gracefully when profile or auth user is missing', async () => {
    mockSupabase({
      enrollments: [{ user_id: 'u9', course_id: 1, enrolled_at: '2026-01-01T00:00:00Z' }],
      courses: [{ id: 1, title_en: 'Gita', title_te: 'గీత', emoji: '📖', bg_color: '#000' }],
    })

    const res = await GET()
    const data = await res.json()
    expect(data.students[0].full_name).toBe('(unknown)')
    expect(data.students[0].email).toBe('')
  })
})
