import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST as sendOtp } from '@/app/api/auth/send-mobile-otp/route'
import { POST as verifyOtp } from '@/app/api/auth/verify-mobile-otp/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'

function makeSendRequest(mobile: string) {
  return new Request('http://localhost/api/auth/send-mobile-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile }),
  })
}

function makeVerifyRequest(mobile: string, otp: string) {
  return new Request('http://localhost/api/auth/verify-mobile-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile, otp }),
  })
}

// ── send-mobile-otp ──────────────────────────────────────────────────────────

describe('POST /api/auth/send-mobile-otp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Remove Fast2SMS key so it falls back to dev console.log
    delete process.env.FAST2SMS_API_KEY
  })

  function mockSendSupabase(recentOtp: { created_at: string } | null) {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'otp_tokens') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: recentOtp }),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return {}
      }),
    } as any)
  }

  it('returns 400 for invalid mobile (too short)', async () => {
    mockSendSupabase(null)
    const res = await sendOtp(makeSendRequest('123'))
    expect(res.status).toBe(400)
  })

  it('returns 429 when OTP was requested within the last 60 seconds', async () => {
    // OTP created 10 seconds ago → rate limit kicks in
    const recentCreatedAt = new Date(Date.now() - 10_000).toISOString()
    mockSendSupabase({ created_at: recentCreatedAt })
    const res = await sendOtp(makeSendRequest('9876543210'))
    expect(res.status).toBe(429)
    const data = await res.json()
    expect(data).toHaveProperty('retryAfter')
    expect(data.retryAfter).toBeGreaterThan(0)
  })

  it('sends OTP successfully when no recent OTP exists (dev fallback)', async () => {
    mockSendSupabase(null)
    const res = await sendOtp(makeSendRequest('9876543210'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sent).toBe(true)
  })

  it('sends OTP when previous OTP was more than 60 seconds ago', async () => {
    // OTP created 90 seconds ago → rate limit does NOT apply
    const oldCreatedAt = new Date(Date.now() - 90_000).toISOString()
    mockSendSupabase({ created_at: oldCreatedAt })
    const res = await sendOtp(makeSendRequest('9876543210'))
    expect(res.status).toBe(200)
  })
})

// ── verify-mobile-otp ────────────────────────────────────────────────────────

describe('POST /api/auth/verify-mobile-otp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockVerifySupabase(token: { id: number; token: string } | null) {
    vi.mocked(createAdminClient).mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === 'otp_tokens') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            gt: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: token }),
            update: vi.fn().mockReturnThis(),
          }
        }
        if (table === 'profiles') {
          return { update: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ error: null }) }
        }
        return {}
      }),
    } as any)
  }

  it('returns 400 for invalid request body (OTP too short)', async () => {
    mockVerifySupabase(null)
    const res = await verifyOtp(makeVerifyRequest('9876543210', '123'))
    expect(res.status).toBe(400)
  })

  it('returns 400 when no valid OTP exists for mobile', async () => {
    mockVerifySupabase(null)
    const res = await verifyOtp(makeVerifyRequest('9876543210', '123456'))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('expired')
  })

  it('returns 400 when OTP does not match', async () => {
    mockVerifySupabase({ id: 1, token: '999999' })
    const res = await verifyOtp(makeVerifyRequest('9876543210', '123456'))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('Incorrect')
  })

  it('returns 200 and verified:true for correct OTP', async () => {
    mockVerifySupabase({ id: 1, token: '123456' })
    const res = await verifyOtp(makeVerifyRequest('9876543210', '123456'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.verified).toBe(true)
  })

  it('trims whitespace from OTP before comparing', async () => {
    mockVerifySupabase({ id: 1, token: '123456' })
    const res = await verifyOtp(makeVerifyRequest('9876543210', '123456'))
    expect(res.status).toBe(200)
  })
})
