import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { GET } from '@/app/api/admin/certificate-preview/route'

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

function mockAdminDb({
  course = { title_en: 'Vedanta Basics', title_te: 'వేదాంత పాఠాలు', emoji: '🪷' },
  profile = { full_name: 'Arjuna Kumar' },
}: {
  course?: Record<string, unknown> | null
  profile?: Record<string, unknown> | null
} = {}) {
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: table === 'courses' ? course : profile }),
    })),
  } as any)
}

function req(query: string) {
  return new Request(`http://localhost/api/admin/certificate-preview?${query}`)
}

describe('GET /api/admin/certificate-preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', email: 'a@b.c', full_name: 'Admin', avatar_initials: 'A' })
    mockAdminDb()
  })

  it('returns 403 for non-admins', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    const res = await GET(req('courseId=1&name=Test'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when courseId is missing', async () => {
    const res = await GET(req('name=Test'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when neither userId nor name is given', async () => {
    const res = await GET(req('courseId=1'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid date', async () => {
    const res = await GET(req('courseId=1&name=Test&date=not-a-date'))
    expect(res.status).toBe(400)
  })

  it('returns 404 for an unknown course', async () => {
    mockAdminDb({ course: null })
    const res = await GET(req('courseId=999&name=Test'))
    expect(res.status).toBe(404)
  })

  it('returns 404 for an unknown student', async () => {
    mockAdminDb({ profile: null })
    const res = await GET(req('courseId=1&userId=u-does-not-exist'))
    expect(res.status).toBe(404)
  })

  it('generates an inline specimen PDF for a free-text name', async () => {
    const res = await GET(req('courseId=1&name=శ్రీధర్ వోలేటి&date=2026-07-12'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toContain('inline')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(10000)
  })

  it('generates a clean PDF for a registered student when specimen=0', async () => {
    const res = await GET(req('courseId=1&userId=u1&specimen=0'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    const buf = Buffer.from(await res.arrayBuffer())
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
