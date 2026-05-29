import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PATCH } from '@/app/api/admin/courses/[id]/publish/route'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }
const idParams = { params: Promise.resolve({ id: '1' }) }
const dummyReq = new Request('http://localhost/', { method: 'PATCH' })

function mockToggle(currentPublished: boolean) {
  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      single: vi.fn()
        .mockResolvedValueOnce({ data: { is_published: currentPublished }, error: null })
        .mockResolvedValueOnce({ data: { id: 1, is_published: !currentPublished }, error: null }),
    }),
  } as any)
}

describe('PATCH /api/admin/courses/[id]/publish', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await PATCH(dummyReq, idParams)
    expect(forbidden).toHaveBeenCalled()
  })

  it('toggles published false → true', async () => {
    mockToggle(false)
    const res = await PATCH(dummyReq, idParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.is_published).toBe(true)
  })

  it('toggles published true → false', async () => {
    mockToggle(true)
    const res = await PATCH(dummyReq, idParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.is_published).toBe(false)
  })
})
