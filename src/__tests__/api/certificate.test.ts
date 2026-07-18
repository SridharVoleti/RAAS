import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/certificate/[courseId]/route'
import { GET as GET_PDF } from '@/app/api/certificate/[courseId]/pdf/route'

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
  chapters?: { id: number }[]
  chapterQuestions?: { chapter_id: number }[]
  passingChapterSubs?: { chapter_id: number; submitted_at: string }[]
}

// Builder mock: chainable methods + thenable so both awaited chains and
// .single()/.maybeSingle() terminals resolve
function builder(rows: unknown, single?: unknown) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'not']) {
    b[m] = vi.fn().mockReturnValue(b)
  }
  b.single = vi.fn().mockResolvedValue({ data: single ?? rows })
  b.maybeSingle = vi.fn().mockResolvedValue({ data: single ?? rows })
  b.then = (resolve: (v: unknown) => void) => resolve({ data: rows })
  return b
}

function mockClients({
  enrollment = { is_active: true, exam_only: false },
  examSession = null,
  courseProgress = { progress_pct: 100 },
  profileName = 'Arjuna Kumar',
  progressRecord = { completed_at: '2024-06-01T10:00:00Z' },
  courseInfo = { title_en: 'Vedanta Basics', title_te: 'వేదాంత పాఠాలు', emoji: '🪷', paths: { certificates_enabled: true } },
  chapters = [],
  chapterQuestions = [],
  passingChapterSubs = [],
}: TableMock = {}, user: { id: string } | null = { id: 'u1' }) {

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => {
      if (table === 'enrollments')      return builder(null, enrollment)
      if (table === 'exam_sessions')    return builder(null, examSession)
      if (table === 'vw_my_courses')    return builder(null, courseProgress)
      if (table === 'profiles')         return builder(null, { full_name: profileName })
      if (table === 'user_progress')    return builder(null, progressRecord)
      if (table === 'quiz_submissions') return builder(passingChapterSubs)
      return builder(null)
    }),
  } as any)

  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'courses')        return builder(null, courseInfo)
      if (table === 'chapters')       return builder(chapters)
      if (table === 'exam_questions') return builder(chapterQuestions)
      return builder(null)
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

  it('returns 403 when the course path has certificates disabled', async () => {
    mockClients({
      chapters: [],
      courseInfo: { title_en: 'Other Path Course', title_te: null, emoji: '📖', paths: { certificates_enabled: false } },
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('not available')
  })

  it('returns 403 for full-course student when lessons are not all completed', async () => {
    mockClients({ courseProgress: { progress_pct: 60 } })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('not yet completed')
    expect(data.progress).toBe(60)
  })

  it('returns 403 when a chapter quiz has not been passed', async () => {
    mockClients({
      chapters: [{ id: 10 }, { id: 11 }],
      chapterQuestions: [{ chapter_id: 10 }, { chapter_id: 10 }, { chapter_id: 11 }],
      passingChapterSubs: [{ chapter_id: 10, submitted_at: '2024-06-02T09:00:00Z' }],
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('chapter quizzes')
  })

  it('returns certificate when all lessons and all chapter quizzes are done', async () => {
    mockClients({
      chapters: [{ id: 10 }, { id: 11 }],
      chapterQuestions: [{ chapter_id: 10 }, { chapter_id: 11 }],
      passingChapterSubs: [
        { chapter_id: 10, submitted_at: '2024-06-02T09:00:00Z' },
        { chapter_id: 11, submitted_at: '2024-06-05T09:00:00Z' },
      ],
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.studentName).toBe('Arjuna Kumar')
    expect(data.courseTitle).toBe('Vedanta Basics')
    expect(data.courseTitleTe).toBe('వేదాంత పాఠాలు')
    // latest of lesson tick (06-01) and chapter quiz pass (06-05)
    expect(data.completedAt).toBe('2024-06-05T09:00:00Z')
    expect(data.courseId).toBe(1)
  })

  it('returns certificate for a course with no chapter quizzes', async () => {
    mockClients({ chapters: [{ id: 10 }], chapterQuestions: [] })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.completedAt).toBe('2024-06-01T10:00:00Z')
  })

  it('does not require the final exam on the full-course track', async () => {
    mockClients({ examSession: null, chapters: [] })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
  })

  it('returns 403 for exam-only student who has not passed', async () => {
    mockClients({ enrollment: { is_active: true, exam_only: true }, examSession: null })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('pass the certification exam')
  })

  it('returns certificate for exam-only student who passed', async () => {
    mockClients({
      enrollment: { is_active: true, exam_only: true },
      examSession: { id: 'sess-1', score: 72, submitted_at: '2024-06-10T12:00:00Z' },
    })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.studentName).toBe('Arjuna Kumar')
    expect(data.completedAt).toBe('2024-06-10T12:00:00Z')
    expect(data.examScore).toBe(72)
  })

  it('falls back to current date when no progress record exists', async () => {
    mockClients({ progressRecord: null, chapters: [] })
    const res = await GET(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.completedAt).toBeTruthy()
  })
})

describe('GET /api/certificate/[courseId]/pdf', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when user is not authenticated', async () => {
    mockClients({}, null)
    const res = await GET_PDF(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not eligible', async () => {
    mockClients({ courseProgress: { progress_pct: 40 } })
    const res = await GET_PDF(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
  })

  it('returns a downloadable PDF with Telugu course title for an eligible student', async () => {
    mockClients({ chapters: [] })
    const res = await GET_PDF(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('attachment')
    expect(res.headers.get('Content-Disposition')).toContain('Arjuna Kumar')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(10000)
  })

  it('serves inline when ?inline=1 is passed', async () => {
    mockClients({ chapters: [] })
    const res = await GET_PDF(new Request('http://localhost/?inline=1'), courseParams)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toContain('inline')
  })
})
