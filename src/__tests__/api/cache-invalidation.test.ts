import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST, GET } from '@/app/api/admin/courses/route'
import { PUT, DELETE } from '@/app/api/admin/courses/[id]/route'
import { PATCH } from '@/app/api/admin/courses/[id]/publish/route'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }

const validCourse = {
  path_id: 1, slug: 'new-course', title_en: 'New Course', title_te: 'నూతన కోర్సు',
  description_en: 'A description for the course', description_te: 'కోర్సు వివరణ ఉంది',
  instructor_en: 'Instructor', instructor_te: 'ఉపాధ్యాయుడు',
  category: 'Vedic', level: 'Beginner',
}

function setupAdminMocks() {
  vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
  vi.mocked(forbidden).mockReturnValue(
    new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
  )
}

function makeRequest(method: string, body?: unknown) {
  return new Request('http://localhost/', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('Cache invalidation on admin course mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupAdminMocks()
  })

  it('POST /api/admin/courses revalidates /explore and / on success', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1, ...validCourse }, error: null }),
      }),
    } as any)

    await POST(makeRequest('POST', validCourse))
    expect(revalidatePath).toHaveBeenCalledWith('/explore')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('POST /api/admin/courses does NOT revalidate on validation error', async () => {
    await POST(makeRequest('POST', { slug: 'only-slug' }))
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('PUT /api/admin/courses/[id] revalidates on success', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1, title_en: 'Updated' }, error: null }),
      }),
    } as any)

    await PUT(makeRequest('PUT', { title_en: 'Updated' }), { params: Promise.resolve({ id: '1' }) })
    expect(revalidatePath).toHaveBeenCalledWith('/explore')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('DELETE /api/admin/courses/[id] revalidates on success', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'enrollments') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ count: 0 }) }
        }
        return { delete: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
      }),
    } as any)

    await DELETE(makeRequest('DELETE'), { params: Promise.resolve({ id: '1' }) })
    expect(revalidatePath).toHaveBeenCalledWith('/explore')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('DELETE /api/admin/courses/[id] does NOT revalidate when course has enrollments', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ count: 3 }),
      }),
    } as any)

    await DELETE(makeRequest('DELETE'), { params: Promise.resolve({ id: '1' }) })
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('PATCH /api/admin/courses/[id]/publish revalidates on toggle', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: { is_published: false }, error: null })
          .mockResolvedValueOnce({ data: { id: 1, is_published: true }, error: null }),
      }),
    } as any)

    await PATCH(makeRequest('PATCH'), { params: Promise.resolve({ id: '1' }) })
    expect(revalidatePath).toHaveBeenCalledWith('/explore')
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('GET /api/admin/courses does NOT revalidate (read-only)', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as any)

    await GET()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
