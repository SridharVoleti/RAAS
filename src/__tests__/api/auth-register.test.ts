import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendWelcomeEmail: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))

import { POST } from '@/app/api/auth/register/route'
import { createAdminClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/auth/register', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}

function mockSupabase(result: { data?: { user: { id: string } }; error?: { message: string } | null }) {
  const createUser = vi.fn().mockResolvedValue({
    data:  result.data  ?? {},
    error: result.error ?? null,
  })
  vi.mocked(createAdminClient).mockResolvedValue({
    auth: { admin: { createUser } },
  } as any)
  return createUser
}

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── Validation ────────────────────────────────────────────────────────────────

  it('returns 400 when password is missing', async () => {
    const res = await POST(makeRequest({ email: 'a@b.com' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when neither email nor mobile is provided', async () => {
    const res  = await POST(makeRequest({ password: 'pass123' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('required')
  })

  it('returns 400 when body is invalid JSON', async () => {
    const req = new Request('http://localhost/api/auth/register', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    'not json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when Supabase createUser returns an error', async () => {
    mockSupabase({ error: { message: 'User already registered' } })
    const res  = await POST(makeRequest({ email: 'exists@test.com', password: 'pass123' }))
    expect(res.status).toBe(400)
  })

  // ── Email registration ────────────────────────────────────────────────────────

  it('registers with email and returns 200, fires sendWelcomeEmail', async () => {
    mockSupabase({ data: { user: { id: 'new-id' } }, error: null })
    const res  = await POST(makeRequest({ email: 'new@test.com', password: 'pass123' }))
    expect(res.status).toBe(200)
    expect((await res.json()).success).toBe(true)
    expect(sendWelcomeEmail).toHaveBeenCalledWith('new-id')
  })

  it('uses real email as Supabase auth email', async () => {
    const createUser = mockSupabase({ data: { user: { id: 'u1' } }, error: null })
    await POST(makeRequest({ email: 'real@test.com', password: 'pass123', mobile: '+919876543210' }))
    expect(createUser.mock.calls[0][0].email).toBe('real@test.com')
    expect(createUser.mock.calls[0][0].user_metadata.is_mobile_user).toBe(false)
  })

  it('passes optional profile fields to user_metadata', async () => {
    const createUser = mockSupabase({ data: { user: { id: 'u1' } }, error: null })
    await POST(makeRequest({
      email: 'test@test.com', password: 'pass',
      fullName: 'Arjuna', city: 'Hyderabad', mobile: '9999999999',
    }))
    const meta = createUser.mock.calls[0][0].user_metadata
    expect(meta.full_name).toBe('Arjuna')
    expect(meta.city).toBe('Hyderabad')
    expect(meta.mobile).toBe('9999999999')
    expect(createUser.mock.calls[0][0].email_confirm).toBe(true)
  })

  // ── Mobile-only registration ──────────────────────────────────────────────────

  it('registers with mobile only and generates synthetic email', async () => {
    const createUser = mockSupabase({ data: { user: { id: 'mob-id' } }, error: null })
    const res  = await POST(makeRequest({ mobile: '+919876543210', password: 'pass123' }))
    expect(res.status).toBe(200)
    const authEmail = createUser.mock.calls[0][0].email as string
    expect(authEmail).toMatch(/^919876543210@mobile\.srikrishnamargam\.in$/)
  })

  it('does NOT fire sendWelcomeEmail for mobile-only registration', async () => {
    mockSupabase({ data: { user: { id: 'mob-id' } }, error: null })
    await POST(makeRequest({ mobile: '+919876543210', password: 'pass123' }))
    expect(sendWelcomeEmail).not.toHaveBeenCalled()
  })

  it('sets is_mobile_user=true in user_metadata for mobile-only', async () => {
    const createUser = mockSupabase({ data: { user: { id: 'mob-id' } }, error: null })
    await POST(makeRequest({ mobile: '+919876543210', password: 'pass123' }))
    expect(createUser.mock.calls[0][0].user_metadata.is_mobile_user).toBe(true)
  })

  it('mobile-only: strips non-digits from mobile for synthetic email', async () => {
    const createUser = mockSupabase({ data: { user: { id: 'u1' } }, error: null })
    await POST(makeRequest({ mobile: '+91 98765-43210', password: 'pass' }))
    const authEmail = createUser.mock.calls[0][0].email as string
    expect(authEmail).toBe('919876543210@mobile.srikrishnamargam.in')
  })

  it('mobile-only: collapses a country code the mobile field already contains (e.g. autofill stuffing the full international number into the local-number field)', async () => {
    const createUser = mockSupabase({ data: { user: { id: 'u1' } }, error: null })
    await POST(makeRequest({ mobile: '+91 98765 43210', isd: '+91', password: 'pass' }))
    const authEmail = createUser.mock.calls[0][0].email as string
    expect(authEmail).toBe('919876543210@mobile.srikrishnamargam.in')
  })

  it('mobile-only: honors a non-default ISD code', async () => {
    const createUser = mockSupabase({ data: { user: { id: 'u1' } }, error: null })
    await POST(makeRequest({ mobile: '9876543210', isd: '+1', password: 'pass' }))
    const authEmail = createUser.mock.calls[0][0].email as string
    expect(authEmail).toBe('19876543210@mobile.srikrishnamargam.in')
  })
})
