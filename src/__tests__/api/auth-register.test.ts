import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendWelcomeEmail: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

import { POST } from '@/app/api/auth/register/route'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockSupabase(result: { data?: { user: { id: string } }; error?: { message: string } | null }) {
  vi.mocked(createAdminClient).mockResolvedValue({
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: result.data ?? {}, error: result.error ?? null }),
      },
    },
  } as any)
}

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 when email is missing', async () => {
    const res = await POST(makeRequest({ password: 'pass123' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('required')
  })

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'test@test.com' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('required')
  })

  it('returns 400 when body is not valid JSON', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when Supabase createUser returns an error', async () => {
    mockSupabase({ error: { message: 'User already registered' } })
    const res = await POST(makeRequest({ email: 'exists@test.com', password: 'pass123' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeTruthy()
  })

  it('returns 200 and fires sendWelcomeEmail on success', async () => {
    mockSupabase({ data: { user: { id: 'new-user-id' } }, error: null })
    const res = await POST(makeRequest({ email: 'new@test.com', password: 'pass123', fullName: 'New User' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(sendWelcomeEmail).toHaveBeenCalledWith('new-user-id')
  })

  it('passes optional profile fields to createUser metadata', async () => {
    const createUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    vi.mocked(createAdminClient).mockResolvedValue({
      auth: { admin: { createUser } },
    } as any)

    await POST(makeRequest({
      email: 'test@test.com',
      password: 'pass',
      fullName: 'Arjuna',
      city: 'Hyderabad',
      mobile: '9999999999',
    }))

    const call = createUser.mock.calls[0][0]
    expect(call.user_metadata.full_name).toBe('Arjuna')
    expect(call.user_metadata.city).toBe('Hyderabad')
    expect(call.user_metadata.mobile).toBe('9999999999')
    expect(call.email_confirm).toBe(true)
  })
})
