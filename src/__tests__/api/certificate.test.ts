import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/certificate/[courseId]/route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createClient, createAdminClient } from '@/lib/supabase/server'

const courseParams = { params: Promise.resolve({ courseId: '1' }) }

type TableMock = {
  enrollment?: Record<string, unknown> | null
  examSession?: Record<string, unknown> | null
  courseProgress?: Record<string, unknown> | null
  courseInfo?: Record<string, unknown> | null
  profileName?: string
  progressRecord?: Record<string, unknown> | null
  courseHasExam?: boolean
}

function mockClients({
  enrollment = { is_active: true, exam_only: false },
  examSession = null,
  courseProgress = null,
  profileName = 'Arjuna Kumar',
  progressRecord = { completed_at: '2024-06-01T10:00:00Z' },
  courseInfo = { title_en: 'Vedanta Basics', title_te: 'వేదాంత పాఠాలు', emoji: '🪷' },
  courseHasExam = false,
}: TableMock = {}, user: { id: string } | null = { id: 'u1' }) {

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: enrollment }),
        }
      }
      if (table === 'exam_sessions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: examSession }),
        }
      }
      if (table === 'vw_my_courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: courseProgress }),
        }
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { full_name: profileName } }),
        }
      }
      if (table === 'user_progress') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: progressRecord }),
        }
      }
      return {}
    }),
  } as any)

  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() => {
            // first call returns has_exam check, second returns course info
            return Promise.resolve({ data: { has_exam: courseHasExam, ...courseInfo } })
          }),
        }
      }
      return {}
    }),
  } as any)
}

describe('GET /api/certificate/[courseId]', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when user is not authenticated', async () => {
    mockClients({}, null)
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(401)
  })

  it('returns 403 when user is not enrolled', async () => {
    mockClients({ enrollment: null })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('Not enrolled')
  })

  it('returns 403 for full-course student when course is not completed', async () => {
    mockClients({
      enrollment: { is_active: true, exam_only: false },
      courseProgress: { title_en: 'Vedanta', title_te: null, progress_pct: 60, emoji: '📖', activated_at: '2024-01-01' },
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('not yet completed')
    expect(data.progress).toBe(60)
  })

  it('returns 403 when course has exam but student has not passed it', async () => {
    mockClients({
      enrollment: { is_active: true, exam_only: false },
      examSession: null,
      courseProgress: { title_en: 'Vedanta', title_te: null, progress_pct: 100, emoji: '📖', activated_at: '2024-01-01' },
      courseHasExam: true,
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('pass the certification exam')
  })

  it('returns 403 for exam-only student who has not passed', async () => {
    mockClients({
      enrollment: { is_active: true, exam_only: true },
      examSession: null,
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('pass the certification exam')
  })

  it('returns certificate for exam-only student who passed', async () => {
    mockClients({
      enrollment: { is_active: true, exam_only: true },
      examSession: { id: 'sess-1', score: 48, submitted_at: '2024-06-10T12:00:00Z' },
      courseInfo: { title_en: 'Vedanta Basics', title_te: 'వేదాంత పాఠాలు', emoji: '🪷', has_exam: true },
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.studentName).toBe('Arjuna Kumar')
    expect(data.courseTitle).toBe('Vedanta Basics')
    expect(data.completedAt).toBe('2024-06-10T12:00:00Z')
    expect(data.examScore).toBe(48)
  })

  it('returns certificate for full-course student with no exam requirement', async () => {
    mockClients({
      enrollment: { is_active: true, exam_only: false },
      courseProgress: { title_en: 'Vedanta Basics', title_te: 'వేదాంత పాఠాలు', progress_pct: 100, emoji: '🪷', activated_at: '2024-01-01' },
      courseHasExam: false,
      courseInfo: { title_en: 'Vedanta Basics', title_te: 'వేదాంత పాఠాలు', emoji: '🪷', has_exam: false },
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.studentName).toBe('Arjuna Kumar')
    expect(data.courseTitle).toBe('Vedanta Basics')
    expect(data.completedAt).toBe('2024-06-01T10:00:00Z')
    expect(data.courseId).toBe(1)
  })

  it('falls back to current date when no progress record and no exam session', async () => {
    mockClients({
      enrollment: { is_active: true, exam_only: false },
      courseProgress: { title_en: 'Course', title_te: null, progress_pct: 100, emoji: '📖', activated_at: '2024-01-01' },
      courseHasExam: false,
      courseInfo: { title_en: 'Course', title_te: null, emoji: '📖', has_exam: false },
      progressRecord: null,
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.completedAt).toBeTruthy()
  })
})
