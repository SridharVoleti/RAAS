import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/payment/initiate/route'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(), createAdminClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('razorpay', () => ({
  default: vi.fn().mockImplementation(() => ({
    orders: {
      create: vi.fn().mockResolvedValue({ id: 'order_test123', amount: 79900 }),
    },
  })),
}))

import { createClient, createAdminClient } from '@/lib/supabase/server'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/payment/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockAuthUser(
  user: { id: string } | null,
  course: Record<string, unknown> | null = { price: 799, is_published: true, is_free: false }
) {
  const upsertFn = vi.fn().mockResolvedValue({ error: null })
  const insertFn = vi.fn().mockResolvedValue({ error: null })
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      insert: insertFn,
      upsert: upsertFn,
    }),
  } as any)
  // Server-side price lookup added by the security hardening change
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: course }),
    }),
  } as any)
}

describe('POST /api/payment/initiate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret'
  })

  it('returns 400 for invalid request body', async () => {
    mockAuthUser({ id: 'user-1' })
    const req = makeRequest({ courseId: 'bad' })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 503 when Razorpay keys are not configured', async () => {
    delete process.env.RAZORPAY_KEY_ID
    delete process.env.RAZORPAY_KEY_SECRET
    mockAuthUser({ id: 'user-1' })
    const req = makeRequest({ courseId: 1, amount: 799 })
    const res = await POST(req)
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toContain('not configured')
  })

  it('returns 401 when user is not authenticated', async () => {
    mockAuthUser(null)
    const req = makeRequest({ courseId: 1, amount: 799 })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 404 when the course does not exist', async () => {
    mockAuthUser({ id: 'user-1' }, null)
    const req = makeRequest({ courseId: 999, amount: 799 })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('returns 400 for a free course', async () => {
    mockAuthUser({ id: 'user-1' }, { price: 0, is_published: true, is_free: true })
    const req = makeRequest({ courseId: 1, amount: 799 })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 with Razorpay order details on success', async () => {
    mockAuthUser({ id: 'user-1' })
    const req = makeRequest({ courseId: 1, amount: 799 })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toHaveProperty('razorpayOrderId')
    expect(data).toHaveProperty('razorpayKeyId')
    expect(data).toHaveProperty('amount')
  })
})
