import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET as GET_SUMMARY } from '@/app/api/admin/certificates/route'
import { GET as GET_DETAIL } from '@/app/api/admin/certificates/[courseId]/route'

vi.mock('@/lib/admin', () => ({
  getAdminUser: vi.fn(),
  forbidden: () => NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { getAdminUser } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'

const courseParams = { params: Promise.resolve({ courseId: '1' }) }

type Rows = Record<string, unknown>[] | null

// Chainable builder; thenable for awaited chains, single() for terminals
function builder(rows: Rows, single?: unknown) {
  const b: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'in', 'gte', 'order', 'limit']) {
    b[m] = vi.fn().mockReturnValue(b)
  }
  b.single = vi.fn().mockResolvedValue({ data: single ?? null })
  b.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null })
  return b
}

interface DbMock {
  courses?: Rows
  courseSingle?: Record<string, unknown> | null
  lessons?: Rows
  chapters?: Rows
  enrollments?: Rows
  examSessions?: Rows
  userProgress?: Rows
  examQuestions?: Rows
  quizSubmissions?: Rows
  profiles?: Rows
}

function mockDb({
  courses = [],
  courseSingle = { id: 1, slug: 'vedanta', title_en: 'Vedanta Basics', title_te: 'వేదాంత పాఠాలు', emoji: '🪷' },
  lessons = [{ id: 100 }, { id: 101 }],
  chapters = [{ id: 10 }],
  enrollments = [],
  examSessions = [],
  userProgress = [],
  examQuestions = [{ chapter_id: 10 }],
  quizSubmissions = [],
  profiles = [],
}: DbMock = {}) {
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === 'courses')          return builder(courses, courseSingle)
      if (table === 'lessons')          return builder(lessons)
      if (table === 'chapters')         return builder(chapters)
      if (table === 'enrollments')      return builder(enrollments)
      if (table === 'exam_sessions')    return builder(examSessions)
      if (table === 'user_progress')    return builder(userProgress)
      if (table === 'exam_questions')   return builder(examQuestions)
      if (table === 'quiz_submissions') return builder(quizSubmissions)
      if (table === 'profiles')         return builder(profiles)
      return builder(null)
    }),
  } as any)
}

// u1: full-course complete; u2: incomplete lessons; u3: exam-only passed; u4: exam-only not passed
const FULL_SCENARIO: DbMock = {
  enrollments: [
    { user_id: 'u1', exam_only: false },
    { user_id: 'u2', exam_only: false },
    { user_id: 'u3', exam_only: true },
    { user_id: 'u4', exam_only: true },
  ],
  userProgress: [
    { user_id: 'u1', completed_at: '2024-06-01T10:00:00Z' },
    { user_id: 'u1', completed_at: '2024-06-02T10:00:00Z' },
    { user_id: 'u2', completed_at: '2024-06-01T10:00:00Z' },
  ],
  quizSubmissions: [
    { user_id: 'u1', chapter_id: 10, submitted_at: '2024-06-03T10:00:00Z' },
  ],
  examSessions: [
    { user_id: 'u3', score: 72, submitted_at: '2024-06-10T12:00:00Z' },
  ],
  profiles: [
    { id: 'u1', full_name: 'Arjuna Kumar', student_id: 'KM-001' },
    { id: 'u3', full_name: 'Bhima Rao', student_id: 'KM-003' },
  ],
}

describe('GET /api/admin/certificates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', email: 'a@b.c', full_name: 'Admin', avatar_initials: 'A' })
  })

  it('returns 403 for non-admins', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    mockDb()
    const res = await GET_SUMMARY()
    expect(res.status).toBe(403)
  })

  it('returns per-course awarded counts for certificate-enabled courses', async () => {
    mockDb({
      ...FULL_SCENARIO,
      courses: [{ id: 1, title_en: 'Vedanta Basics', title_te: 'వేదాంత పాఠాలు', emoji: '🪷' }],
    })
    const res = await GET_SUMMARY()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.courses).toHaveLength(1)
    // u1 (course track) + u3 (exam track); u2 incomplete, u4 no exam pass
    expect(data.courses[0].awardedCount).toBe(2)
  })
})

describe('GET /api/admin/certificates/[courseId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', email: 'a@b.c', full_name: 'Admin', avatar_initials: 'A' })
  })

  it('returns 403 for non-admins', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    mockDb()
    const res = await GET_DETAIL(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
  })

  it('returns 404 for an unknown course', async () => {
    mockDb({ courseSingle: null })
    const res = await GET_DETAIL(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(404)
  })

  it('lists awarded students with track and completion date, newest first', async () => {
    mockDb(FULL_SCENARIO)
    const res = await GET_DETAIL(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.students).toHaveLength(2)
    // u3 completed 06-10 (exam), u1 completed 06-03 (last chapter quiz)
    expect(data.students[0]).toMatchObject({ userId: 'u3', track: 'exam', examScore: 72, studentName: 'Bhima Rao' })
    expect(data.students[1]).toMatchObject({ userId: 'u1', track: 'course', studentName: 'Arjuna Kumar' })
    expect(data.students[1].completedAt).toBe('2024-06-03T10:00:00Z')
  })

  it('requires chapter quizzes — 100% lessons alone is not awarded', async () => {
    mockDb({
      ...FULL_SCENARIO,
      quizSubmissions: [],
      profiles: [{ id: 'u3', full_name: 'Bhima Rao', student_id: 'KM-003' }],
    })
    const res = await GET_DETAIL(new Request('http://localhost/'), courseParams)
    const data = await res.json()
    expect(data.students.map((s: { userId: string }) => s.userId)).toEqual(['u3'])
  })

  it('exports CSV with header, BOM and escaped fields', async () => {
    mockDb(FULL_SCENARIO)
    const res = await GET_DETAIL(new Request('http://localhost/?format=csv'), courseParams)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/csv')
    expect(res.headers.get('Content-Disposition')).toContain('certificates-vedanta.csv')
    const buf = Buffer.from(await res.arrayBuffer())
    // UTF-8 BOM bytes so Excel opens Telugu names correctly
    expect([...buf.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = buf.subarray(3).toString('utf-8').split('\r\n')
    expect(lines[0]).toBe('Student Name,Student ID,Track,Completed On,Exam Score')
    expect(lines[1]).toBe('Bhima Rao,KM-003,Final Exam,2024-06-10,72')
    expect(lines[2]).toBe('Arjuna Kumar,KM-001,Course,2024-06-03,')
  })
})
