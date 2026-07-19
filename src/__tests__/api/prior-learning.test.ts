import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST as registerPL, GET as listOwnPL } from '@/app/api/prior-learning/route'
import { GET as adminListPL } from '@/app/api/admin/prior-learning/route'

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
  for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
    c[m] = vi.fn(() => c)
  }
  c.upsert = vi.fn(() => c)
  c.single = vi.fn().mockResolvedValue(result)
  c.maybeSingle = vi.fn().mockResolvedValue(result)
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return c
}

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

function mockUser(tables: Record<string, any> = {}, user: { id: string } | null = { id: 'u1' }) {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: makeFrom(tables),
  } as any)
}

function mockAdminClient(tables: Record<string, any | any[]> = {}) {
  vi.mocked(createAdminClient).mockReturnValue({ from: makeFrom(tables) } as any)
}

function jsonRequest(body: unknown) {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const twoSubjects = {
  subjects: [
    { courseId: 1, teacherName: 'Sri Rama Guruji', teacherMobile: '+919876543210' },
    { courseId: 2, teacherName: 'Sri Krishna Swami', teacherMobile: '9123456789' },
  ],
}

const raasCourses = [
  { id: 1, title_en: 'Sri Bhashyam', title_te: 'శ్రీ భాష్యం', has_exam: true },
  { id: 2, title_en: 'Nitya Grantham', title_te: 'నిత్య గ్రంథం', has_exam: false },
]

describe('POST /api/prior-learning', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockUser({}, null)
    mockAdminClient({})
    const res = await registerPL(jsonRequest(twoSubjects))
    expect(res.status).toBe(401)
  })

  it('rejects an invalid guru mobile', async () => {
    mockUser()
    mockAdminClient({})
    const res = await registerPL(jsonRequest({
      subjects: [{ courseId: 1, teacherName: 'Guruji', teacherMobile: 'abc' }],
    }))
    expect(res.status).toBe(400)
  })

  it('rejects an empty subject list', async () => {
    mockUser()
    mockAdminClient({})
    const res = await registerPL(jsonRequest({ subjects: [] }))
    expect(res.status).toBe(400)
  })

  it('rejects duplicate subjects', async () => {
    mockUser()
    mockAdminClient({})
    const res = await registerPL(jsonRequest({
      subjects: [
        { courseId: 1, teacherName: 'Guruji A', teacherMobile: '9876543210' },
        { courseId: 1, teacherName: 'Guruji B', teacherMobile: '9876543211' },
      ],
    }))
    expect(res.status).toBe(400)
  })

  it('rejects subjects that are not published RAAS courses', async () => {
    mockUser()
    // Only one of the two ids comes back from the filtered query
    mockAdminClient({ courses: chain({ data: [raasCourses[0]] }) })
    const res = await registerPL(jsonRequest(twoSubjects))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('not valid RAAS courses')
  })

  it('saves one declaration per subject with its own guru and enrolls exam-only where an exam exists', async () => {
    const declChain = chain({ error: null })
    const enrollSelectChain = chain({ data: [] })
    const enrollUpsertChain = chain({ error: null })
    mockUser()
    mockAdminClient({
      courses: chain({ data: raasCourses }),
      prior_learning_declarations: declChain,
      enrollments: [enrollSelectChain, enrollUpsertChain],
    })

    const res = await registerPL(jsonRequest(twoSubjects))
    expect(res.status).toBe(201)

    const declRows = declChain.upsert.mock.calls[0][0]
    expect(declRows).toHaveLength(2)
    expect(declRows[0]).toMatchObject({
      user_id: 'u1', course_id: 1,
      teacher_name: 'Sri Rama Guruji', teacher_mobile: '+919876543210',
    })
    expect(declRows[1]).toMatchObject({
      user_id: 'u1', course_id: 2,
      teacher_name: 'Sri Krishna Swami', teacher_mobile: '9123456789',
    })

    // Only course 1 has an exam → single exam-only enrollment
    const enrollRows = enrollUpsertChain.upsert.mock.calls[0][0]
    expect(enrollRows).toHaveLength(1)
    expect(enrollRows[0]).toMatchObject({ course_id: 1, exam_only: true, is_active: true })

    const data = await res.json()
    expect(data.subjects).toHaveLength(2)
    expect(data.subjects[0].has_exam).toBe(true)
  })

  it('rejects subjects the student is already fully enrolled in', async () => {
    const enrollSelectChain = chain({
      data: [{ course_id: 1 }],
    })
    mockUser()
    mockAdminClient({
      courses: chain({ data: raasCourses }),
      prior_learning_declarations: chain({ error: null }),
      enrollments: [enrollSelectChain],
    })

    const res = await registerPL(jsonRequest(twoSubjects))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('already enrolled')
  })
})

describe('GET /api/prior-learning', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns the caller\'s declarations and enrolled course ids', async () => {
    const own = [{ course_id: 1, teacher_name: 'Guruji', teacher_mobile: '9876543210', created_at: '2026-07-08' }]
    mockUser({
      prior_learning_declarations: chain({ data: own, error: null }),
      enrollments: chain({ data: [{ course_id: 3 }], error: null }),
    })
    mockAdminClient({})
    const res = await listOwnPL()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.declarations).toEqual(own)
    expect(data.enrolledCourseIds).toEqual([3])
  })
})

describe('GET /api/admin/prior-learning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', email: 'a@b.c' } as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('is forbidden for non-admins', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await adminListPL()
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns registrations with student names attached', async () => {
    mockAdminClient({
      prior_learning_declarations: chain({
        data: [{
          id: 1, user_id: 'u1', course_id: 1,
          teacher_name: 'Guruji', teacher_mobile: '9876543210',
          created_at: '2026-07-08', courses: { title_en: 'Sri Bhashyam' },
        }],
        error: null,
      }),
      profiles: chain({ data: [{ id: 'u1', full_name: 'Arjuna Kumar' }] }),
    })
    const res = await adminListPL()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.declarations[0].student_name).toBe('Arjuna Kumar')
    expect(data.declarations[0].courses.title_en).toBe('Sri Bhashyam')
  })
})
