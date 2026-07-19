import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET as getLessonQuestions, POST as postQuestion } from '@/app/api/qa/lesson/[lessonId]/route'
import { POST as postAnswer } from '@/app/api/qa/question/[questionId]/answer/route'
import { DELETE as deleteQuestion } from '@/app/api/admin/qa/question/[id]/route'
import { DELETE as deleteAnswer } from '@/app/api/admin/qa/answer/[id]/route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

function chain(result: unknown = { data: null, error: null }) {
  const c: any = {}
  for (const m of ['select', 'eq', 'order', 'limit', 'update', 'delete', 'in']) {
    c[m] = vi.fn(() => c)
  }
  c.insert = vi.fn(() => c)
  c.single = vi.fn().mockResolvedValue(result)
  c.maybeSingle = vi.fn().mockResolvedValue(result)
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return c
}

function mockUser(tables: Record<string, any>, user: { id: string } | null = { id: 'u1' }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn((table: string) => tables[table] ?? chain()),
  } as any)
}

function mockAdminClient(tables: Record<string, any>) {
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((table: string) => tables[table] ?? chain()),
  } as any)
}

function jsonRequest(body: unknown) {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const lessonParams = { params: Promise.resolve({ lessonId: '5' }) }
const questionParams = { params: Promise.resolve({ questionId: '9' }) }
const idParams = { params: Promise.resolve({ id: '9' }) }

describe('GET /api/qa/lesson/[lessonId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    mockUser({}, null)
    mockAdminClient({})
    const res = await getLessonQuestions(new Request('http://localhost/'), lessonParams)
    expect(res.status).toBe(401)
  })

  it('returns 403 when not enrolled and not admin', async () => {
    mockUser({
      enrollments: chain({ data: null }),
      profiles: chain({ data: { is_admin: false } }),
    })
    mockAdminClient({ lessons: chain({ data: { course_id: 3 } }) })
    const res = await getLessonQuestions(new Request('http://localhost/'), lessonParams)
    expect(res.status).toBe(403)
  })

  it('returns questions with answers for an enrolled user', async () => {
    mockUser({
      enrollments: chain({ data: { is_active: true } }),
      profiles: chain({ data: { is_admin: false } }),
    })
    mockAdminClient({
      lessons: chain({ data: { course_id: 3 } }),
      course_questions: chain({
        data: [{ id: 1, course_id: 3, lesson_id: 5, user_id: 'u1', body: 'Q1', created_at: 't1' }],
        error: null,
      }),
      course_answers: chain({
        data: [{ id: 10, question_id: 1, user_id: 'u2', body: 'A1', created_at: 't2' }],
        error: null,
      }),
      profiles: chain({
        data: [
          { id: 'u1', full_name: 'Asker', avatar_initials: 'AS' },
          { id: 'u2', full_name: 'Answerer', avatar_initials: 'AN' },
        ],
        error: null,
      }),
    })
    const res = await getLessonQuestions(new Request('http://localhost/'), lessonParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.questions).toHaveLength(1)
    expect(data.questions[0].answers).toHaveLength(1)
    expect(data.questions[0].author_name).toBe('Asker')
    expect(data.questions[0].is_own).toBe(true)
    expect(data.questions[0].answers[0].author_name).toBe('Answerer')
  })

  it('allows an admin who is not enrolled', async () => {
    mockUser({
      enrollments: chain({ data: null }),
      profiles: chain({ data: { is_admin: true } }),
    })
    mockAdminClient({
      lessons: chain({ data: { course_id: 3 } }),
      course_questions: chain({ data: [], error: null }),
    })
    const res = await getLessonQuestions(new Request('http://localhost/'), lessonParams)
    expect(res.status).toBe(200)
  })
})

describe('POST /api/qa/lesson/[lessonId]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when not enrolled and not admin', async () => {
    mockUser({
      enrollments: chain({ data: null }),
      profiles: chain({ data: { is_admin: false } }),
    })
    mockAdminClient({ lessons: chain({ data: { course_id: 3 } }) })
    const res = await postQuestion(jsonRequest({ body: 'What is dharma?' }), lessonParams)
    expect(res.status).toBe(403)
  })

  it('rejects an empty question body', async () => {
    mockUser({}, { id: 'u1' })
    mockAdminClient({})
    const res = await postQuestion(jsonRequest({ body: '' }), lessonParams)
    expect(res.status).toBe(400)
  })

  it('creates a question for an enrolled user', async () => {
    mockUser({
      enrollments: chain({ data: { is_active: true } }),
      profiles: chain({ data: { is_admin: false } }),
    })
    mockAdminClient({
      lessons: chain({ data: { course_id: 3 } }),
      course_questions: chain({
        data: { id: 1, course_id: 3, lesson_id: 5, user_id: 'u1', body: 'What is dharma?', created_at: 't1' },
        error: null,
      }),
      profiles: chain({ data: [{ id: 'u1', full_name: 'Asker', avatar_initials: 'AS' }], error: null }),
    })
    const res = await postQuestion(jsonRequest({ body: 'What is dharma?' }), lessonParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.question.body).toBe('What is dharma?')
    expect(data.question.answers).toEqual([])
    expect(data.question.author_name).toBe('Asker')
  })
})

describe('POST /api/qa/question/[questionId]/answer', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when not enrolled and not admin', async () => {
    mockUser({
      enrollments: chain({ data: null }),
      profiles: chain({ data: { is_admin: false } }),
    })
    mockAdminClient({ course_questions: chain({ data: { course_id: 3 } }) })
    const res = await postAnswer(jsonRequest({ body: 'It is duty.' }), questionParams)
    expect(res.status).toBe(403)
  })

  it('creates an answer for an enrolled user', async () => {
    mockUser({
      enrollments: chain({ data: { is_active: true } }),
      profiles: chain({ data: { is_admin: false } }),
    })
    mockAdminClient({
      course_questions: chain({ data: { course_id: 3 } }),
      course_answers: chain({
        data: { id: 10, question_id: 9, user_id: 'u1', body: 'It is duty.', created_at: 't2' },
        error: null,
      }),
      profiles: chain({ data: [{ id: 'u1', full_name: 'Asker', avatar_initials: 'AS' }], error: null }),
    })
    const res = await postAnswer(jsonRequest({ body: 'It is duty.' }), questionParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.answer.body).toBe('It is duty.')
  })
})

describe('admin qa delete routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('DELETE question is forbidden for non-admins', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    const res = await deleteQuestion(new Request('http://localhost/'), idParams)
    expect(res.status).toBe(403)
  })

  it('DELETE question removes it for an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', email: 'a@b.c' } as any)
    mockAdminClient({ course_questions: chain({ error: null }) })
    const res = await deleteQuestion(new Request('http://localhost/'), idParams)
    expect(res.status).toBe(200)
  })

  it('DELETE answer is forbidden for non-admins', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    const res = await deleteAnswer(new Request('http://localhost/'), idParams)
    expect(res.status).toBe(403)
  })

  it('DELETE answer removes it for an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', email: 'a@b.c' } as any)
    mockAdminClient({ course_answers: chain({ error: null }) })
    const res = await deleteAnswer(new Request('http://localhost/'), idParams)
    expect(res.status).toBe(200)
  })
})
