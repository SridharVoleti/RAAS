import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, PUT } from '@/app/api/admin/email-templates/[type]/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }
const typeParams = { params: Promise.resolve({ type: 'enrollment_confirmation' }) }

function makePutRequest(body: unknown) {
  return new Request('http://localhost/', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('GET /api/admin/email-templates/[type]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await GET(new Request('http://localhost/'), typeParams)
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns 404 when template does not exist', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      }),
    } as any)

    const res = await GET(new Request('http://localhost/'), typeParams)
    expect(res.status).toBe(404)
  })

  it('returns template data when found', async () => {
    const template = { type: 'enrollment_confirmation', subject: 'Welcome!', body: 'Hello', updated_at: '2024-01-01' }
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: template, error: null }),
      }),
    } as any)

    const res = await GET(new Request('http://localhost/'), typeParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.subject).toBe('Welcome!')
  })
})

describe('PUT /api/admin/email-templates/[type]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 400 for invalid body (empty subject)', async () => {
    const res = await PUT(makePutRequest({ subject: '', body: 'Body' }), typeParams)
    expect(res.status).toBe(400)
  })

  it('upserts template and returns 200', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    } as any)

    const res = await PUT(makePutRequest({ subject: 'Welcome!', body: 'Hello dear student' }), typeParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
