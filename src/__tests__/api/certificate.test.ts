import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/certificate/[courseId]/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createClient } from '@/lib/supabase/server'

const courseParams = { params: Promise.resolve({ courseId: '1' }) }

function mockSupabase(
  user: { id: string } | null,
  enrollment: Record<string, unknown> | null,
  profileName = 'Arjuna Kumar'
) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'vw_my_courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: enrollment, error: enrollment ? null : { message: 'not found' } }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { full_name: profileName }, error: null }),
        }
      }
      if (table === 'user_progress') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { completed_at: '2024-06-01T10:00:00Z' } }),
        }
      }
      return {}
    }),
  } as any)
}

describe('GET /api/certificate/[courseId]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when user is not authenticated', async () => {
    mockSupabase(null, null)
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not enrolled in the course', async () => {
    mockSupabase({ id: 'u1' }, null)
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('Not enrolled')
  })

  it('returns 403 when course is not fully completed', async () => {
    mockSupabase({ id: 'u1' }, {
      title_en: 'Vedanta Basics',
      title_te: null,
      progress_pct: 60,
      emoji: '📖',
      activated_at: '2024-01-01',
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('not yet completed')
    expect(data.progress).toBe(60)
  })

  it('returns certificate data for a fully completed course', async () => {
    mockSupabase({ id: 'u1' }, {
      title_en: 'Vedanta Basics',
      title_te: 'వేదాంత పాఠాలు',
      progress_pct: 100,
      emoji: '🪷',
      activated_at: '2024-01-01',
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.studentName).toBe('Arjuna Kumar')
    expect(data.courseTitle).toBe('Vedanta Basics')
    expect(data.courseTitleTe).toBe('వేదాంత పాఠాలు')
    expect(data.emoji).toBe('🪷')
    expect(data.completedAt).toBe('2024-06-01T10:00:00Z')
    expect(data.courseId).toBe(1)
  })

  it('falls back to current date when no progress record exists', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn((table: string) => {
        if (table === 'vw_my_courses') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: { title_en: 'Course', title_te: null, progress_pct: 100, emoji: '📖', activated_at: '2024-01-01' } }),
          }
        }
        if (table === 'profiles') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { full_name: 'Student' } }) }
        }
        if (table === 'user_progress') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }
        }
        return {}
      }),
    } as any)

    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.completedAt).toBeTruthy()
  })
})
