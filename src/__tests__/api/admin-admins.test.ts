import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET, POST } from '@/app/api/admin/admins/route'
import { DELETE } from '@/app/api/admin/admins/[userId]/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true, full_name: 'Admin One' }

function setupAdmin() {
  vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
  vi.mocked(forbidden).mockReturnValue(
    new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
  )
}

// ── GET /api/admin/admins ─────────────────────────────────────────────────────

describe('GET /api/admin/admins', () => {
  beforeEach(() => { vi.clearAllMocks(); setupAdmin() })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await GET()
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns list of admins enriched with email', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'admin-1', full_name: 'Admin One', avatar_initials: 'AO', created_at: '2024-01-01' }],
          error: null,
        }),
      }),
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'admin-1', email: 'admin@example.com' }] },
            error: null,
          }),
        },
      },
    } as any)

    const res = await GET()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveLength(1)
    expect(data[0].email).toBe('admin@example.com')
  })
})

// ── POST /api/admin/admins ────────────────────────────────────────────────────

describe('POST /api/admin/admins', () => {
  beforeEach(() => { vi.clearAllMocks(); setupAdmin() })

  function makeRequest(body: unknown) {
    return new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await POST(makeRequest({ email: 'user@example.com' }))
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ email: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when user email not found', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'other', email: 'other@example.com' }] },
            error: null,
          }),
        },
      },
    } as any)

    const res = await POST(makeRequest({ email: 'notfound@example.com' }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when user is already an admin', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'u1', email: 'user@example.com' }] },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_admin: true } }),
      }),
    } as any)

    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(409)
  })

  it('promotes user and returns 200', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: 'u1', email: 'user@example.com' }] },
            error: null,
          }),
        },
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_admin: false } }),
        update: vi.fn().mockReturnThis(),
      }),
    } as any)

    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})

// ── DELETE /api/admin/admins/[userId] ────────────────────────────────────────

describe('DELETE /api/admin/admins/[userId]', () => {
  beforeEach(() => { vi.clearAllMocks(); setupAdmin() })

  const userParams = { params: Promise.resolve({ userId: 'other-admin' }) }
  const selfParams = { params: Promise.resolve({ userId: 'admin-1' }) }
  const req = new Request('http://localhost/', { method: 'DELETE' })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await DELETE(req, userParams)
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns 400 when trying to demote yourself', async () => {
    const res = await DELETE(req, selfParams)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('yourself')
  })

  it('returns 404 when user not found', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    } as any)

    const res = await DELETE(req, userParams)
    expect(res.status).toBe(404)
  })

  it('returns 400 when target is not an admin', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_admin: false, full_name: 'User' } }),
      }),
    } as any)

    const res = await DELETE(req, userParams)
    expect(res.status).toBe(400)
  })

  it('demotes admin and returns 200', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { is_admin: true, full_name: 'Other Admin' } }),
        update: vi.fn().mockReturnThis(),
      }),
    } as any)

    const res = await DELETE(req, userParams)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
  })
})
