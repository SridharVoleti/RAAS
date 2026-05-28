import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { csrfCheck } from '@/lib/csrf'

const APP_URL = 'http://localhost:3000'

describe('csrfCheck', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = APP_URL
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('allows GET requests unconditionally', () => {
    expect(csrfCheck('/api/courses', 'GET', 'https://evil.com')).toBeNull()
  })

  it('allows HEAD requests unconditionally', () => {
    expect(csrfCheck('/api/courses', 'HEAD', 'https://evil.com')).toBeNull()
  })

  it('allows requests with no Origin header (server-to-server)', () => {
    expect(csrfCheck('/api/enroll/free', 'POST', null)).toBeNull()
  })

  it('allows same-origin POST requests', () => {
    expect(csrfCheck('/api/enroll/free', 'POST', APP_URL)).toBeNull()
  })

  it('blocks cross-origin POST requests', () => {
    const result = csrfCheck('/api/enroll/free', 'POST', 'https://evil.com')
    expect(result).not.toBeNull()
    expect(result?.status).toBe(403)
  })

  it('blocks cross-origin PUT requests', () => {
    const result = csrfCheck('/api/admin/courses/1', 'PUT', 'https://attacker.example')
    expect(result?.status).toBe(403)
  })

  it('blocks cross-origin DELETE requests', () => {
    const result = csrfCheck('/api/admin/courses/1', 'DELETE', 'http://different-port.com:4000')
    expect(result?.status).toBe(403)
  })

  it('exempts /api/payment/webhook from CSRF check', () => {
    expect(csrfCheck('/api/payment/webhook', 'POST', 'https://api.razorpay.com')).toBeNull()
  })

  it('exempts /api/admin/bootstrap from CSRF check', () => {
    expect(csrfCheck('/api/admin/bootstrap', 'POST', 'https://some-client.com')).toBeNull()
  })

  it('allows when NEXT_PUBLIC_APP_URL is not set (build time / CI)', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    expect(csrfCheck('/api/enroll/free', 'POST', 'https://evil.com')).toBeNull()
  })

  it('blocks malformed Origin header', () => {
    const result = csrfCheck('/api/enroll/free', 'POST', 'not-a-url')
    expect(result?.status).toBe(403)
  })

  it('allows same-origin PATCH requests', () => {
    expect(csrfCheck('/api/admin/courses/1/publish', 'PATCH', APP_URL)).toBeNull()
  })
})
