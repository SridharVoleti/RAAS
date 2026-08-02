import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/admin/courses/[id]/students/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }
const mockCourse = { id: 1, title_en: 'Bhagavad Gita', title_te: 'భగవద్గీత', slug: 'bhagavad-gita' }

function mockSupabase(opts: {
  course?: Record<string, unknown> | null
  courseError?: boolean
  enrollments?: Record<string, unknown>[]
  profiles?: Record<string, unknown>[]
  authUsers?: { id: string; email: string }[]
}) {
  const {
    course = mockCourse,
    courseError = false,
    enrollments = [],
    profiles = [],
    authUsers = [],
  } = opts

  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: courseError ? null : course, error: courseError ? { message: 'not found' } : null }),
        }
      }
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: enrollments, error: null }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: profiles, error: null }),
        }
      }
      return {}
    }),
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: authUsers } }),
      },
    },
  } as any)
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('GET /api/admin/courses/[id]/students', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await GET(new Request('http://localhost/api/admin/courses/1/students'), makeParams('1'))
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns 404 when the course does not exist', async () => {
    mockSupabase({ courseError: true })
    const res = await GET(new Request('http://localhost/api/admin/courses/999/students'), makeParams('999'))
    expect(res.status).toBe(404)
  })

  it('returns empty items when no one has enrolled', async () => {
    mockSupabase({ enrollments: [] })
    const res = await GET(new Request('http://localhost/api/admin/courses/1/students'), makeParams('1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.course).toEqual(mockCourse)
    expect(data.items).toEqual([])
  })

  it('joins enrollments with profiles and auth emails', async () => {
    mockSupabase({
      enrollments: [{ user_id: 'u1', enrolled_at: '2026-01-01T00:00:00Z', is_active: true, activated_at: '2026-01-01T00:00:00Z' }],
      profiles: [{ id: 'u1', full_name: 'Alice', avatar_initials: 'A', student_id: 42, username: 'alice', mobile: '9876543210', isd_code: '+91', city: 'Hyderabad', country: 'India' }],
      authUsers: [{ id: 'u1', email: 'alice@example.com' }],
    })
    const res = await GET(new Request('http://localhost/api/admin/courses/1/students'), makeParams('1'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toHaveLength(1)
    expect(data.items[0]).toMatchObject({
      id: 'u1',
      full_name: 'Alice',
      email: 'alice@example.com',
      is_active: true,
    })
  })

  it('defaults name and email gracefully when profile or auth user is missing', async () => {
    mockSupabase({
      enrollments: [{ user_id: 'u2', enrolled_at: '2026-01-01T00:00:00Z', is_active: false, activated_at: null }],
      profiles: [],
      authUsers: [],
    })
    const res = await GET(new Request('http://localhost/api/admin/courses/1/students'), makeParams('1'))
    const data = await res.json()
    expect(data.items[0].full_name).toBe('(unknown)')
    expect(data.items[0].email).toBe('')
    expect(data.items[0].is_active).toBe(false)
  })
})
