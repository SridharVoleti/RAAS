import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { POST } from '@/app/api/auth/resolve-login/route'
import { createAdminClient } from '@/lib/supabase/server'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/resolve-login', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function mockUsers(users: { id: string; email?: string; user_metadata?: Record<string, unknown> }[]) {
  vi.mocked(createAdminClient).mockResolvedValue({
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users }, error: null }),
      },
    },
  } as any)
}

describe('POST /api/auth/resolve-login', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Email inputs ─────────────────────────────────────────────────────────────

  it('returns 400 for missing username', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns email as-is for email input (no DB lookup)', async () => {
    const res  = await POST(makeRequest({ username: 'user@example.com' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.authEmail).toBe('user@example.com')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('lowercases email input', async () => {
    const res  = await POST(makeRequest({ username: 'User@Example.COM' }))
    const data = await res.json()
    expect(data.authEmail).toBe('user@example.com')
  })

  // ── Mobile-only users (synthetic email in auth) ───────────────────────────────

  it('resolves 10-digit Indian mobile to synthetic email', async () => {
    mockUsers([{ id: 'u1', email: '919876543210@mobile.srikrishnamargam.in' }])
    const res  = await POST(makeRequest({ username: '9876543210' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.authEmail).toBe('919876543210@mobile.srikrishnamargam.in')
  })

  it('resolves mobile with + prefix to synthetic email', async () => {
    mockUsers([{ id: 'u1', email: '919876543210@mobile.srikrishnamargam.in' }])
    const res  = await POST(makeRequest({ username: '+919876543210' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.authEmail).toBe('919876543210@mobile.srikrishnamargam.in')
  })

  it('resolves mobile with spaces/dashes to synthetic email', async () => {
    mockUsers([{ id: 'u1', email: '919876543210@mobile.srikrishnamargam.in' }])
    const res  = await POST(makeRequest({ username: '98765 43210' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.authEmail).toBe('919876543210@mobile.srikrishnamargam.in')
  })

  // ── Email+mobile users (real email, mobile in metadata) ──────────────────────

  it('resolves mobile to real email when user registered with email+mobile', async () => {
    mockUsers([
      {
        id: 'u2',
        email: 'arjuna@example.com',
        user_metadata: { mobile: '+919876543210' },
      },
    ])
    const res  = await POST(makeRequest({ username: '9876543210' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.authEmail).toBe('arjuna@example.com')
  })

  it('resolves a non-Indian number typed with its own country code (not assumed to be a bare Indian number)', async () => {
    mockUsers([{ id: 'u1', email: '19876543210@mobile.srikrishnamargam.in' }])
    const res  = await POST(makeRequest({ username: '+19876543210' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.authEmail).toBe('19876543210@mobile.srikrishnamargam.in')
  })

  it('resolves mobile to real email when registered mobile metadata itself already includes the country code', async () => {
    mockUsers([
      {
        id: 'u2',
        email: 'arjuna@example.com',
        user_metadata: { mobile: '919876543210' },
      },
    ])
    const res  = await POST(makeRequest({ username: '9876543210' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.authEmail).toBe('arjuna@example.com')
  })

  // ── Not found ─────────────────────────────────────────────────────────────────

  it('returns 404 when mobile is not registered', async () => {
    mockUsers([])
    const res = await POST(makeRequest({ username: '9999999999' }))
    expect(res.status).toBe(404)
    const data = await res.json()
    expect(data.error).toContain('No account found')
  })

  // ── Priority: synthetic email wins over metadata match ────────────────────────

  it('prefers synthetic email match over metadata match', async () => {
    mockUsers([
      {
        id: 'u1',
        email: '919876543210@mobile.srikrishnamargam.in',
      },
      {
        id: 'u2',
        email: 'real@example.com',
        user_metadata: { mobile: '+919876543210' },
      },
    ])
    const res  = await POST(makeRequest({ username: '9876543210' }))
    const data = await res.json()
    expect(data.authEmail).toBe('919876543210@mobile.srikrishnamargam.in')
  })

  // ── Error handling ────────────────────────────────────────────────────────────

  it('returns 500 when listUsers fails', async () => {
    vi.mocked(createAdminClient).mockResolvedValue({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [] },
            error: { message: 'DB error' },
          }),
        },
      },
    } as any)
    const res = await POST(makeRequest({ username: '9876543210' }))
    expect(res.status).toBe(500)
  })
})
