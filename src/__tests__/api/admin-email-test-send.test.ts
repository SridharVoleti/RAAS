import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/email', () => ({
  renderHtml: vi.fn().mockReturnValue('<html>test</html>'),
  BrandConfig: {},
}))
vi.mock('resend', () => ({
  Resend: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}))

import { Resend } from 'resend'
import { getAdminUser, forbidden } from '@/lib/admin'
import { POST } from '@/app/api/admin/email/test-send/route'

const mockAdmin = { id: 'admin-1', email: 'admin@test.com', is_admin: true }

function makeRequest(body?: unknown) {
  return new Request('http://localhost/api/admin/email/test-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}

function mockResendSend(result: { data?: { id: string }; error?: unknown } = { data: { id: 'email-1' } }) {
  const sendFn = vi.fn().mockResolvedValue(result)
  vi.mocked(Resend).mockImplementation(() => ({ emails: { send: sendFn } } as any))
  return sendFn
}

describe('POST /api/admin/email/test-send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await POST(makeRequest())
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns 503 when RESEND_API_KEY is not set', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    delete process.env.RESEND_API_KEY

    const res = await POST(makeRequest())
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toContain('RESEND_API_KEY')
  })

  it('sends to admin email by default and returns 200', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    process.env.RESEND_API_KEY = 'test-key'
    const sendFn = mockResendSend()

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.to).toBe('admin@test.com')
    expect(sendFn).toHaveBeenCalledOnce()
    expect(sendFn.mock.calls[0][0].to).toEqual(['admin@test.com'])
  })

  it('sends to the provided to address when valid', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    process.env.RESEND_API_KEY = 'test-key'
    const sendFn = mockResendSend()

    const res = await POST(makeRequest({ to: 'custom@example.com' }))
    expect(res.status).toBe(200)
    expect(sendFn.mock.calls[0][0].to).toEqual(['custom@example.com'])
  })

  it('falls back to admin email when provided to is not a valid address', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    process.env.RESEND_API_KEY = 'test-key'
    const sendFn = mockResendSend()

    const res = await POST(makeRequest({ to: 'not-an-email' }))
    expect(res.status).toBe(200)
    expect(sendFn.mock.calls[0][0].to).toEqual(['admin@test.com'])
  })

  it('returns 500 when Resend.send throws', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    process.env.RESEND_API_KEY = 'test-key'
    const sendFn = vi.fn().mockRejectedValue(new Error('Resend down'))
    vi.mocked(Resend).mockImplementation(() => ({ emails: { send: sendFn } } as any))

    const res = await POST(makeRequest())
    expect(res.status).toBe(500)
  })

  afterEach(() => {
    delete process.env.RESEND_API_KEY
  })
})
