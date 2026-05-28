import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'
import { POST } from '@/app/api/payment/webhook/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendEnrollmentEmail: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'

const WEBHOOK_SECRET = 'test-webhook-secret'

function sign(body: string, secret = WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

function makeRequest(body: string, signature: string) {
  return new Request('http://localhost/api/payment/webhook', {
    method: 'POST',
    headers: { 'x-razorpay-signature': signature },
    body,
  })
}

function mockSupabase(paymentData: Record<string, unknown> | null = null, fetchError = false) {
  const updateBuilder = { eq: vi.fn().mockReturnThis() }
  const upsertBuilder = {}

  const fromMock = vi.fn((table: string) => {
    if (table === 'payment_logs') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(
          fetchError
            ? { data: null, error: { message: 'not found' } }
            : { data: paymentData, error: null }
        ),
        update: vi.fn().mockReturnValue(updateBuilder),
      }
    }
    if (table === 'enrollments') {
      return { upsert: vi.fn().mockResolvedValue({ error: null }) }
    }
    return upsertBuilder
  })

  vi.mocked(createAdminClient).mockResolvedValue({ from: fromMock } as any)
  return fromMock
}

describe('POST /api/payment/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
  })

  it('returns 500 when webhook secret is not configured', async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET
    const body = JSON.stringify({ event: 'payment.captured', payload: {} })
    const req = makeRequest(body, sign(body))
    const res = await POST(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain('secret')
  })

  it('returns 400 for invalid HMAC signature', async () => {
    const body = JSON.stringify({ event: 'payment.captured', payload: {} })
    const req = makeRequest(body, 'deadbeef'.repeat(8))
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('signature')
  })

  it('returns 400 for invalid JSON body (valid signature)', async () => {
    const body = 'not-valid-json'
    const req = makeRequest(body, sign(body))
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('acknowledges non-payment events without acting', async () => {
    mockSupabase()
    const body = JSON.stringify({ event: 'subscription.activated', payload: {} })
    const req = makeRequest(body, sign(body))
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it('returns 400 when order_id is missing from payload', async () => {
    mockSupabase()
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123' } } },
    })
    const req = makeRequest(body, sign(body))
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain('order_id')
  })

  it('returns 200 when payment log is not found (lets Razorpay stop retrying)', async () => {
    mockSupabase(null, true)
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123', order_id: 'order_xyz' } } },
    })
    const req = makeRequest(body, sign(body))
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('is idempotent — returns 200 without re-processing already-paid orders', async () => {
    mockSupabase({ id: 1, user_id: 'u1', course_id: 2, status: 'paid' })
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_123', order_id: 'order_abc' } } },
    })
    const req = makeRequest(body, sign(body))
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBe(true)
  })

  it('activates enrollment and returns 200 for a valid payment.captured event', async () => {
    const fromMock = mockSupabase({ id: 1, user_id: 'u1', course_id: 2, status: 'created' })
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_abc', order_id: 'order_xyz' } } },
    })
    const req = makeRequest(body, sign(body))
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('enrollments')
  })

  it('handles order.paid event the same as payment.captured', async () => {
    mockSupabase({ id: 2, user_id: 'u2', course_id: 3, status: 'created' })
    const body = JSON.stringify({
      event: 'order.paid',
      payload: { payment: { entity: { id: 'pay_def', order_id: 'order_ghi' } } },
    })
    const req = makeRequest(body, sign(body))
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
