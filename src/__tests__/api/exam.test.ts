import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST as startExam } from '@/app/api/exam/[courseId]/start/route'
import { POST as answerExam } from '@/app/api/exam/[courseId]/answer/route'
import { POST as enrollExamOnly } from '@/app/api/enroll/exam-only/route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createClient, createAdminClient } from '@/lib/supabase/server'

const courseParams = { params: Promise.resolve({ courseId: '1' }) }

/** Chainable query builder mock: chain methods return self, terminal methods resolve `result`. */
function chain(result: unknown = { data: null, error: null }) {
  const c: any = {}
  for (const m of ['select', 'eq', 'gt', 'order', 'limit', 'in', 'update']) {
    c[m] = vi.fn(() => c)
  }
  c.insert = vi.fn(() => c)
  c.upsert = vi.fn(() => c)
  c.single = vi.fn().mockResolvedValue(result)
  c.maybeSingle = vi.fn().mockResolvedValue(result)
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return c
}

/** exam_questions chain that answers `.in('id', ids)` with generated full rows. */
function questionRowsChain(correctOption: (id: number) => string) {
  const c: any = {
    select: vi.fn(() => c),
    eq: vi.fn(() => c),
    _ids: [] as number[],
    in: vi.fn((_col: string, ids: number[]) => { c._ids = ids; return c }),
    then: (resolve: any) => resolve({
      data: c._ids.map((id: number) => ({
        id,
        course_id: 1,
        chapter_name: `Ch${Math.ceil(id / 50)}`,
        question_te: `Q${id}`,
        option_a_te: 'A', option_b_te: 'B', option_c_te: 'C', option_d_te: 'D',
        correct_option: correctOption(id),
        created_at: '2026-01-01',
      })),
    }),
  }
  return c
}

/** from() implementation that hands out chains per table, in sequence when given an array. */
function makeFrom(tables: Record<string, any | any[]>) {
  const counters: Record<string, number> = {}
  return vi.fn((table: string) => {
    const entry = tables[table]
    if (Array.isArray(entry)) {
      const i = counters[table] ?? 0
      counters[table] = i + 1
      return entry[Math.min(i, entry.length - 1)]
    }
    return entry ?? chain()
  })
}

function mockUser(from: ReturnType<typeof makeFrom>, user: { id: string } | null = { id: 'u1' }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  } as any)
}

function mockAdmin(from: ReturnType<typeof makeFrom>) {
  vi.mocked(createAdminClient).mockResolvedValue({ from } as any)
}

function makeBankRows(count: number, chapters: number) {
  const perChapter = Math.ceil(count / chapters)
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    chapter_name: `Ch${Math.floor(i / perChapter) + 1}`,
  }))
}

function jsonRequest(body: unknown) {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/exam/[courseId]/start', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockUser(makeFrom({}), null)
    mockAdmin(makeFrom({}))
    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not enrolled', async () => {
    mockUser(makeFrom({}))
    mockAdmin(makeFrom({
      enrollments: chain({ data: null }),
      courses: chain({ data: { id: 1, title_en: 'X' } }),
    }))
    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
  })

  it('blocks after two failed attempts for exam-only students with must_take_course', async () => {
    mockUser(makeFrom({
      exam_sessions: chain({ data: [{ id: 'f1' }, { id: 'f2' }] }),
    }))
    mockAdmin(makeFrom({
      enrollments: chain({ data: { is_active: true, exam_only: true } }),
      courses: chain({ data: { id: 1, title_en: 'X' } }),
    }))
    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toBe('must_take_course')
    expect(data.message).toContain('take this course')
  })

  it('allows a second attempt after exactly one failed attempt', async () => {
    const insertChain = chain({ data: { id: 'sess-retry' }, error: null })
    mockUser(makeFrom({
      exam_sessions: [chain({ data: [{ id: 'f1' }] }), insertChain],
    }))
    mockAdmin(makeFrom({
      enrollments: chain({ data: { is_active: true, exam_only: true } }),
      courses: chain({ data: { id: 1, title_en: 'X' } }),
      exam_sessions: chain(),
      exam_questions: [
        chain({ data: makeBankRows(40, 4) }),
        questionRowsChain(() => 'a'),
      ],
    }))

    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const inserted = insertChain.insert.mock.calls[0][0]
    expect(inserted.session_type).toBe('exam_only')
  })

  it('creates a 100-question timed session for exam-only students with a large bank', async () => {
    const insertChain = chain({ data: { id: 'sess-1' }, error: null })
    mockUser(makeFrom({
      exam_sessions: [chain({ data: null }), insertChain],
    }))
    mockAdmin(makeFrom({
      enrollments: chain({ data: { is_active: true, exam_only: true } }),
      courses: chain({ data: { id: 1, title_en: 'X' } }),
      exam_sessions: chain(),
      exam_questions: [
        chain({ data: makeBankRows(250, 5) }),
        questionRowsChain(() => 'a'),
      ],
    }))

    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)

    const inserted = insertChain.insert.mock.calls[0][0]
    expect(inserted.question_sequence).toHaveLength(100)
    expect(inserted.session_type).toBe('exam_only')
    expect(inserted.expires_at).toBeTruthy()
    // 100 minutes, allow a little runtime slack
    const durationMs = new Date(inserted.expires_at).getTime() - Date.now()
    expect(durationMs).toBeGreaterThan(99 * 60 * 1000)
    expect(durationMs).toBeLessThanOrEqual(100 * 60 * 1000)

    const data = await res.json()
    expect(data.session_id).toBe('sess-1')
    expect(data.questions).toHaveLength(10)
    expect(data.total_questions).toBe(100)
    expect(data.total_pages).toBe(10)
    expect(data.questions[0]).not.toHaveProperty('correct_option')
  })

  it('uses half the bank (rounded up), not the whole thing, when it has fewer than 100 questions', async () => {
    const insertChain = chain({ data: { id: 'sess-2' }, error: null })
    mockUser(makeFrom({
      exam_sessions: [chain({ data: null }), insertChain],
    }))
    mockAdmin(makeFrom({
      enrollments: chain({ data: { is_active: true, exam_only: true } }),
      courses: chain({ data: { id: 1, title_en: 'X' } }),
      exam_sessions: chain(),
      exam_questions: [
        chain({ data: makeBankRows(40, 4) }),
        questionRowsChain(() => 'a'),
      ],
    }))

    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const inserted = insertChain.insert.mock.calls[0][0]
    expect(inserted.question_sequence).toHaveLength(20)
  })

  it('rounds the half-bank target up to the nearest 10 (35 questions -> 20)', async () => {
    const insertChain = chain({ data: { id: 'sess-3' }, error: null })
    mockUser(makeFrom({
      exam_sessions: [chain({ data: null }), insertChain],
    }))
    mockAdmin(makeFrom({
      enrollments: chain({ data: { is_active: true, exam_only: true } }),
      courses: chain({ data: { id: 1, title_en: 'X' } }),
      exam_sessions: chain(),
      exam_questions: [
        chain({ data: makeBankRows(35, 4) }),
        questionRowsChain(() => 'a'),
      ],
    }))

    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const inserted = insertChain.insert.mock.calls[0][0]
    expect(inserted.question_sequence).toHaveLength(20)
  })

  it('caps the rounded-up target at the bank size when rounding would exceed it', async () => {
    const insertChain = chain({ data: { id: 'sess-4' }, error: null })
    mockUser(makeFrom({
      exam_sessions: [chain({ data: null }), insertChain],
    }))
    mockAdmin(makeFrom({
      enrollments: chain({ data: { is_active: true, exam_only: true } }),
      courses: chain({ data: { id: 1, title_en: 'X' } }),
      exam_sessions: chain(),
      exam_questions: [
        chain({ data: makeBankRows(7, 4) }),
        questionRowsChain(() => 'a'),
      ],
    }))

    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const inserted = insertChain.insert.mock.calls[0][0]
    expect(inserted.question_sequence).toHaveLength(7)
  })

  it('creates an untimed 5-per-chapter session for regular course students', async () => {
    const insertChain = chain({ data: { id: 'sess-3' }, error: null })
    mockUser(makeFrom({
      exam_sessions: [chain({ data: null }), insertChain],
    }))
    mockAdmin(makeFrom({
      enrollments: chain({ data: { is_active: true, exam_only: false } }),
      courses: chain({ data: { id: 1, title_en: 'X' } }),
      exam_sessions: chain(),
      exam_questions: [
        chain({ data: makeBankRows(30, 3) }),
        questionRowsChain(() => 'a'),
      ],
    }))

    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(200)
    const inserted = insertChain.insert.mock.calls[0][0]
    expect(inserted.question_sequence).toHaveLength(15)
    expect(inserted.session_type).toBe('course')
    expect(inserted.expires_at).toBeNull()
  })

  it('applies the 48h cooldown to regular students only', async () => {
    mockUser(makeFrom({
      exam_sessions: chain({ data: { submitted_at: new Date().toISOString() } }),
    }))
    mockAdmin(makeFrom({
      enrollments: chain({ data: { is_active: true, exam_only: false } }),
      courses: chain({ data: { id: 1, title_en: 'X' } }),
    }))
    const res = await startExam(new Request('http://localhost/'), courseParams)
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data.error).toBe('cooldown')
  })
})

describe('POST /api/exam/[courseId]/answer', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const seq = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  function session(overrides: Record<string, unknown> = {}) {
    return {
      id: 'sess-1',
      question_sequence: seq,
      questions_answered: 0,
      answers: {},
      session_type: 'exam_only',
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      ...overrides,
    }
  }

  function pageBody(answer: (id: number) => string) {
    return {
      session_id: '11111111-1111-4111-8111-111111111111',
      answers: seq.map(id => ({ question_id: id, answer: answer(id) })),
    }
  }

  it('passes at exactly 60%', async () => {
    mockUser(makeFrom({ exam_sessions: chain({ data: session() }) }))
    mockAdmin(makeFrom({
      exam_questions: questionRowsChain(() => 'a'),
      exam_sessions: chain(),
    }))
    // 6 of 10 correct
    const res = await answerExam(
      jsonRequest(pageBody(id => (id <= 6 ? 'a' : 'b'))), courseParams
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.done).toBe(true)
    expect(data.score).toBe(6)
    expect(data.total).toBe(10)
    expect(data.passed).toBe(true)
    expect(data.must_take_course).toBeUndefined()
  })

  it('fails below 60% on the first attempt and allows an immediate retry', async () => {
    mockUser(makeFrom({
      // 1st call: load the in-progress session. 2nd call: count of failed attempts
      // so far (this one included) — only 1, so the 2-attempt limit isn't hit yet.
      exam_sessions: [chain({ data: session() }), chain({ data: [{ id: 'this-one' }] })],
    }))
    mockAdmin(makeFrom({
      exam_questions: questionRowsChain(() => 'a'),
      exam_sessions: chain(),
    }))
    // 5 of 10 correct
    const res = await answerExam(
      jsonRequest(pageBody(id => (id <= 5 ? 'a' : 'b'))), courseParams
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.passed).toBe(false)
    expect(data.exam_only).toBe(true)
    expect(data.must_take_course).toBeUndefined()
  })

  it('blocks with must_take_course after the second failed attempt', async () => {
    mockUser(makeFrom({
      // 2nd call: count of failed attempts now includes a prior failure plus this one.
      exam_sessions: [chain({ data: session() }), chain({ data: [{ id: 'prior' }, { id: 'this-one' }] })],
    }))
    mockAdmin(makeFrom({
      exam_questions: questionRowsChain(() => 'a'),
      exam_sessions: chain(),
    }))
    // 5 of 10 correct
    const res = await answerExam(
      jsonRequest(pageBody(id => (id <= 5 ? 'a' : 'b'))), courseParams
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.passed).toBe(false)
    expect(data.must_take_course).toBe(true)
  })

  it('finalizes an expired session with previously saved answers only', async () => {
    mockUser(makeFrom({
      exam_sessions: [
        chain({
          data: session({
            expires_at: new Date(Date.now() - 1000).toISOString(),
            answers: { '1': 'a', '2': 'a' },
            questions_answered: 2,
          }),
        }),
        // Count of failed attempts including this one — a prior failure plus this
        // one hits the 2-attempt limit, so this test still exercises must_take_course.
        chain({ data: [{ id: 'prior' }, { id: 'this-one' }] }),
      ],
    }))
    mockAdmin(makeFrom({
      exam_questions: questionRowsChain(() => 'a'),
      exam_sessions: chain(),
    }))
    const res = await answerExam(
      jsonRequest({ session_id: '11111111-1111-4111-8111-111111111111', answers: [] }),
      courseParams
    )
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.done).toBe(true)
    expect(data.expired).toBe(true)
    expect(data.score).toBe(2)
    expect(data.total).toBe(10)
    expect(data.passed).toBe(false)
    expect(data.must_take_course).toBe(true)
  })

  it('rejects answers that do not match the current page', async () => {
    mockUser(makeFrom({ exam_sessions: chain({ data: session() }) }))
    mockAdmin(makeFrom({}))
    const res = await answerExam(
      jsonRequest({
        session_id: '11111111-1111-4111-8111-111111111111',
        answers: [{ question_id: 99, answer: 'a' }],
      }),
      courseParams
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/enroll/exam-only', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const validBody = {
    courseId: 1,
    teacherName: 'Sri Guruji',
    teacherMobile: '+919876543210',
    bookName: 'Bhagavad Gita',
  }

  it('rejects a request without guru details', async () => {
    mockUser(makeFrom({}))
    mockAdmin(makeFrom({}))
    const res = await enrollExamOnly(jsonRequest({ courseId: 1 }))
    expect(res.status).toBe(400)
  })

  it('rejects an invalid guru mobile number', async () => {
    mockUser(makeFrom({}))
    mockAdmin(makeFrom({}))
    const res = await enrollExamOnly(jsonRequest({ ...validBody, teacherMobile: 'not-a-number' }))
    expect(res.status).toBe(400)
  })

  it('saves the prior-learning declaration and enrolls the student', async () => {
    const declChain = { upsert: vi.fn().mockResolvedValue({ error: null }) }
    const enrollUpsert = chain({ data: { id: 5, exam_only: true, is_active: true }, error: null })
    mockUser(makeFrom({ enrollments: chain({ data: null }) }))
    mockAdmin(makeFrom({
      courses: chain({ data: { id: 1, has_exam: true, is_published: true, title_en: 'X' } }),
      prior_learning_declarations: declChain,
      enrollments: enrollUpsert,
    }))

    const res = await enrollExamOnly(jsonRequest(validBody))
    expect(res.status).toBe(201)

    expect(declChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        course_id: 1,
        teacher_name: 'Sri Guruji',
        teacher_mobile: '+919876543210',
        book_name: 'Bhagavad Gita',
      }),
      { onConflict: 'user_id,course_id' }
    )
    expect(enrollUpsert.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ exam_only: true, is_active: true }),
      { onConflict: 'user_id,course_id' }
    )
  })

  it('returns 400 when the course has no exam option', async () => {
    mockUser(makeFrom({}))
    mockAdmin(makeFrom({
      courses: chain({ data: { id: 1, has_exam: false, is_published: true, title_en: 'X' } }),
    }))
    const res = await enrollExamOnly(jsonRequest(validBody))
    expect(res.status).toBe(400)
  })
})
