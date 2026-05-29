import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PUT, DELETE } from '@/app/api/admin/courses/[id]/route'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }
const idParams = { params: Promise.resolve({ id: '1' }) }

function makePutRequest(body: unknown) {
  return new Request('http://localhost/api/admin/courses/1', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PUT /api/admin/courses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await PUT(makePutRequest({}), idParams)
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns 400 for invalid body', async () => {
    const res = await PUT(makePutRequest({ slug: 'Invalid Slug!' }), idParams)
    expect(res.status).toBe(400)
  })

  it('updates course and returns 200', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 1, title_en: 'Updated' }, error: null }),
      }),
    } as any)
    const res = await PUT(makePutRequest({ title_en: 'Updated' }), idParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.title_en).toBe('Updated')
  })
})

describe('DELETE /api/admin/courses/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await DELETE(new Request('http://localhost/', { method: 'DELETE' }), idParams)
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns 400 when course has active enrollments', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ count: 3 }),
          }
        }
        return {}
      }),
    } as any)
    const res = await DELETE(new Request('http://localhost/', { method: 'DELETE' }), idParams)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('enrollments')
  })

  it('deletes course when no enrollments exist', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'enrollments') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ count: 0 }),
          }
        }
        if (table === 'courses') {
          return {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return {}
      }),
    } as any)
    const res = await DELETE(new Request('http://localhost/', { method: 'DELETE' }), idParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
