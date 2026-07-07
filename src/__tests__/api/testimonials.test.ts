import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST as submitVoice, GET as listOwnVoices } from '@/app/api/testimonials/route'
import { GET as adminList } from '@/app/api/admin/testimonials/route'
import { PATCH as adminPatch, DELETE as adminDelete } from '@/app/api/admin/testimonials/[id]/route'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { revalidateTag } from 'next/cache'

const idParams = { params: Promise.resolve({ id: '7' }) }

function chain(result: unknown = { data: null, error: null }) {
  const c: any = {}
  for (const m of ['select', 'eq', 'order', 'limit', 'update', 'delete']) {
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

const validBody = {
  reviewerName: 'Arjuna Kumar',
  message: 'This course transformed my daily practice.',
  rating: 5,
  courseId: 3,
}

describe('POST /api/testimonials', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 when unauthenticated', async () => {
    mockUser({}, null)
    mockAdminClient({})
    const res = await submitVoice(jsonRequest(validBody))
    expect(res.status).toBe(401)
  })

  it('returns 403 when the student has no active enrollment', async () => {
    mockUser({ enrollments: chain({ data: null }) })
    mockAdminClient({})
    const res = await submitVoice(jsonRequest(validBody))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('enroll')
  })

  it('rejects a message that is too short', async () => {
    mockUser({ enrollments: chain({ data: { id: 1 } }) })
    mockAdminClient({})
    const res = await submitVoice(jsonRequest({ ...validBody, message: 'short' }))
    expect(res.status).toBe(400)
  })

  it('rejects an out-of-range rating', async () => {
    mockUser({ enrollments: chain({ data: { id: 1 } }) })
    mockAdminClient({})
    const res = await submitVoice(jsonRequest({ ...validBody, rating: 6 }))
    expect(res.status).toBe(400)
  })

  it('inserts a hidden testimonial linked to the student', async () => {
    const insertChain = chain({ data: { id: 42 }, error: null })
    mockUser({ enrollments: chain({ data: { id: 1 } }) })
    mockAdminClient({ testimonials: insertChain })

    const res = await submitVoice(jsonRequest(validBody))
    expect(res.status).toBe(201)
    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      reviewer_name: 'Arjuna Kumar',
      content_en: 'This course transformed my daily practice.',
      rating: 5,
      course_id: 3,
      is_published: false,
    })
  })

  it('allows submission without a course (general feedback)', async () => {
    const insertChain = chain({ data: { id: 43 }, error: null })
    mockUser({ enrollments: chain({ data: { id: 1 } }) })
    mockAdminClient({ testimonials: insertChain })

    const { courseId: _omit, ...noCourse } = validBody
    const res = await submitVoice(jsonRequest(noCourse))
    expect(res.status).toBe(201)
    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ course_id: null, is_published: false })
    )
  })
})

describe('GET /api/testimonials', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns the caller\'s own submissions', async () => {
    const own = [{ id: 1, content_en: 'Great', is_published: false }]
    mockUser({})
    mockAdminClient({ testimonials: chain({ data: own, error: null }) })
    const res = await listOwnVoices()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.testimonials).toEqual(own)
  })
})

describe('admin testimonials routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', email: 'a@b.c' } as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('GET is forbidden for non-admins', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await adminList()
    expect(forbidden).toHaveBeenCalled()
  })

  it('GET lists all testimonials including hidden ones', async () => {
    const rows = [
      { id: 1, is_published: true },
      { id: 2, is_published: false },
    ]
    mockAdminClient({ testimonials: chain({ data: rows, error: null }) })
    const res = await adminList()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.testimonials).toHaveLength(2)
  })

  it('PATCH toggles visibility and revalidates the home cache', async () => {
    const updateChain = chain({ data: { id: 7, is_published: true }, error: null })
    mockAdminClient({ testimonials: updateChain })

    const res = await adminPatch(
      jsonRequest({ is_published: true }) as any,
      idParams
    )
    expect(res.status).toBe(200)
    expect(updateChain.update).toHaveBeenCalledWith({ is_published: true })
    expect(revalidateTag).toHaveBeenCalledWith('testimonials')
  })

  it('PATCH rejects a non-boolean body', async () => {
    mockAdminClient({})
    const res = await adminPatch(jsonRequest({ is_published: 'yes' }) as any, idParams)
    expect(res.status).toBe(400)
  })

  it('PATCH rejects an invalid id', async () => {
    mockAdminClient({})
    const res = await adminPatch(
      jsonRequest({ is_published: true }) as any,
      { params: Promise.resolve({ id: 'abc' }) }
    )
    expect(res.status).toBe(400)
  })

  it('DELETE removes the testimonial and revalidates the home cache', async () => {
    const delChain = chain({ error: null })
    mockAdminClient({ testimonials: delChain })

    const res = await adminDelete(new Request('http://localhost/'), idParams)
    expect(res.status).toBe(200)
    expect(delChain.delete).toHaveBeenCalled()
    expect(revalidateTag).toHaveBeenCalledWith('testimonials')
  })
})
