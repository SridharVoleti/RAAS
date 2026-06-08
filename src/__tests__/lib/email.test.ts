import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('resend', () => ({
  Resend: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'
import {
  applyVariables,
  renderHtml,
  sendEnrollmentEmail,
  sendWelcomeEmail,
  sendPaymentReceivedEmail,
  type BrandConfig,
} from '@/lib/email'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TEST_BRAND: BrandConfig = {
  fromEmail:      'Test <test@example.com>',
  appUrl:         'https://example.com',
  primaryColor:   '#ff0000',
  bgColor:        '#000000',
  cardBg:         '#111111',
  headerBg:       '#222222',
  borderColor:    '#333333',
  bodyTextColor:  '#ffffff',
  mutedTextColor: '#888888',
  symbol:         '★',
  brandNameLocal: 'Test Brand',
  brandNameEn:    'Test Brand EN',
  footerLine1:    'Footer line 1',
  footerLine2:    'Footer line 2',
  ctaLabel:       'Click here',
  ctaPath:        '/start',
}

function makeSendMock() {
  return vi.fn().mockResolvedValue({ data: { id: 'email-abc123' }, error: null })
}

function mockResend(sendFn = makeSendMock()) {
  vi.mocked(Resend).mockImplementation(() => ({ emails: { send: sendFn } } as any))
  return sendFn
}

function mockSupabase({
  userEmail = 'student@example.com',
  fullName = 'Test Student',
  titleEn = 'Vedic Maths',
  titleTe = 'వైదిక గణితం',
  template = null as { subject: string; body: string } | null,
  noUser = false,
  noProfile = false,
  noCourse = false,
} = {}) {
  vi.mocked(createAdminClient).mockResolvedValue({
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({
          data: { user: noUser ? null : { id: 'user-1', email: userEmail } },
        }),
      },
    },
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: noProfile ? null : { full_name: fullName },
            error: null,
          }),
        }
      }
      if (table === 'courses') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: noCourse ? null : { title_en: titleEn, title_te: titleTe },
            error: null,
          }),
        }
      }
      if (table === 'email_templates') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: template, error: null }),
        }
      }
      return {}
    }),
  } as any)
}

// ── applyVariables ────────────────────────────────────────────────────────────

describe('applyVariables', () => {
  it('substitutes a single variable', () => {
    expect(applyVariables('Hello {{name}}!', { name: 'Sridhar' })).toBe('Hello Sridhar!')
  })

  it('substitutes multiple variables', () => {
    const result = applyVariables('{{greeting}}, {{name}}. Course: {{course}}', {
      greeting: 'Namaskar',
      name: 'Priya',
      course: 'Vedic Maths',
    })
    expect(result).toBe('Namaskar, Priya. Course: Vedic Maths')
  })

  it('replaces all occurrences of the same variable', () => {
    expect(applyVariables('{{x}} and {{x}}', { x: 'hello' })).toBe('hello and hello')
  })

  it('leaves unknown tokens unchanged', () => {
    expect(applyVariables('Hello {{unknown}}', { name: 'x' })).toBe('Hello {{unknown}}')
  })

  it('returns the input unchanged when vars is empty', () => {
    expect(applyVariables('Hello {{name}}', {})).toBe('Hello {{name}}')
  })

  it('handles empty string input', () => {
    expect(applyVariables('', { name: 'x' })).toBe('')
  })
})

// ── renderHtml ────────────────────────────────────────────────────────────────

describe('renderHtml', () => {
  it('returns a valid HTML document', () => {
    const html = renderHtml('Hello world', 'Test Subject', TEST_BRAND)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
  })

  it('includes the subject in an h1', () => {
    const html = renderHtml('Body text', 'My Subject Line', TEST_BRAND)
    expect(html).toContain('My Subject Line')
  })

  it('includes the body text', () => {
    const html = renderHtml('Course starts tomorrow', 'Subject', TEST_BRAND)
    expect(html).toContain('Course starts tomorrow')
  })

  it('uses brand primary color', () => {
    const html = renderHtml('Body', 'Subject', TEST_BRAND)
    expect(html).toContain('#ff0000')
  })

  it('uses brand symbol in header', () => {
    const html = renderHtml('Body', 'Subject', TEST_BRAND)
    expect(html).toContain('★')
  })

  it('includes the CTA link with correct path', () => {
    const html = renderHtml('Body', 'Subject', TEST_BRAND)
    expect(html).toContain('https://example.com/start')
    expect(html).toContain('Click here')
  })

  it('converts blank lines to <br> tags', () => {
    const html = renderHtml('Line 1\n\nLine 2', 'Subject', TEST_BRAND)
    expect(html).toContain('<br>')
  })

  it('wraps non-blank lines in <p> tags', () => {
    const html = renderHtml('Hello student', 'Subject', TEST_BRAND)
    expect(html).toMatch(/<p[^>]*>Hello student<\/p>/)
  })

  it('includes footer lines', () => {
    const html = renderHtml('Body', 'Subject', TEST_BRAND)
    expect(html).toContain('Footer line 1')
    expect(html).toContain('Footer line 2')
  })
})

// ── sendEnrollmentEmail ───────────────────────────────────────────────────────

describe('sendEnrollmentEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.clearAllMocks()
  })
  afterEach(() => {
    delete process.env.RESEND_API_KEY
  })

  it('sends an email with the correct recipient', async () => {
    const sendFn = mockResend()
    mockSupabase()
    await sendEnrollmentEmail('user-1', 1)
    expect(sendFn).toHaveBeenCalledOnce()
    const call = sendFn.mock.calls[0][0]
    expect(call.to).toEqual(['student@example.com'])
  })

  it('interpolates course name into subject', async () => {
    const sendFn = mockResend()
    mockSupabase({ titleEn: 'Vedic Maths' })
    await sendEnrollmentEmail('user-1', 1)
    const call = sendFn.mock.calls[0][0]
    expect(call.subject).toContain('Vedic Maths')
  })

  it('uses DB template when available', async () => {
    const sendFn = mockResend()
    mockSupabase({ template: { subject: 'Custom {{course_en}}', body: 'Custom body for {{name}}' } })
    await sendEnrollmentEmail('user-1', 1)
    const call = sendFn.mock.calls[0][0]
    expect(call.subject).toBe('Custom Vedic Maths')
    expect(call.html).toContain('Custom body for Test Student')
  })

  it('falls back to default template when DB returns null', async () => {
    const sendFn = mockResend()
    mockSupabase({ template: null })
    await sendEnrollmentEmail('user-1', 1)
    expect(sendFn).toHaveBeenCalledOnce()
    const call = sendFn.mock.calls[0][0]
    expect(call.subject).toContain('Vedic Maths')
  })

  it('does not send when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    const sendFn = mockResend()
    mockSupabase()
    await sendEnrollmentEmail('user-1', 1)
    expect(sendFn).not.toHaveBeenCalled()
  })

  it('does not throw when user is not found', async () => {
    mockResend()
    mockSupabase({ noUser: true })
    await expect(sendEnrollmentEmail('bad-id', 1)).resolves.toBeUndefined()
  })

  it('does not throw when course is not found', async () => {
    mockResend()
    mockSupabase({ noCourse: true })
    await expect(sendEnrollmentEmail('user-1', 999)).resolves.toBeUndefined()
  })

  it('does not throw when Resend.send rejects', async () => {
    mockResend(vi.fn().mockRejectedValue(new Error('Resend API error')))
    mockSupabase()
    await expect(sendEnrollmentEmail('user-1', 1)).resolves.toBeUndefined()
  })
})

// ── sendWelcomeEmail ──────────────────────────────────────────────────────────

describe('sendWelcomeEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.clearAllMocks()
  })
  afterEach(() => {
    delete process.env.RESEND_API_KEY
  })

  it('sends a welcome email with the student name', async () => {
    const sendFn = mockResend()
    mockSupabase({ fullName: 'Arjuna' })
    await sendWelcomeEmail('user-1')
    expect(sendFn).toHaveBeenCalledOnce()
    const call = sendFn.mock.calls[0][0]
    expect(call.subject).toContain('Arjuna')
    expect(call.to).toEqual(['student@example.com'])
  })

  it('uses "Student" as fallback when profile has no name', async () => {
    const sendFn = mockResend()
    mockSupabase({ noProfile: true })
    await sendWelcomeEmail('user-1')
    const call = sendFn.mock.calls[0][0]
    expect(call.subject).toContain('Student')
  })

  it('CTA links to /explore not /my-courses', async () => {
    const sendFn = mockResend()
    mockSupabase()
    await sendWelcomeEmail('user-1')
    const call = sendFn.mock.calls[0][0]
    expect(call.html).toContain('/explore')
  })

  it('does not send when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    const sendFn = mockResend()
    mockSupabase()
    await sendWelcomeEmail('user-1')
    expect(sendFn).not.toHaveBeenCalled()
  })

  it('does not throw when user is not found', async () => {
    mockResend()
    mockSupabase({ noUser: true })
    await expect(sendWelcomeEmail('bad-id')).resolves.toBeUndefined()
  })

  it('does not throw when Resend.send rejects', async () => {
    mockResend(vi.fn().mockRejectedValue(new Error('network failure')))
    mockSupabase()
    await expect(sendWelcomeEmail('user-1')).resolves.toBeUndefined()
  })
})

// ── sendPaymentReceivedEmail ──────────────────────────────────────────────────

describe('sendPaymentReceivedEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 'test-key'
    vi.clearAllMocks()
  })
  afterEach(() => {
    delete process.env.RESEND_API_KEY
  })

  it('sends a payment email with correct course name', async () => {
    const sendFn = mockResend()
    mockSupabase({ titleEn: 'Yoga Sutras' })
    await sendPaymentReceivedEmail('user-1', 2, 79900, 'order_ABC')
    expect(sendFn).toHaveBeenCalledOnce()
    const call = sendFn.mock.calls[0][0]
    expect(call.subject).toContain('Yoga Sutras')
  })

  it('converts paise to rupees correctly (79900 paise → ₹799.00)', async () => {
    const sendFn = mockResend()
    mockSupabase()
    await sendPaymentReceivedEmail('user-1', 2, 79900, 'order_ABC')
    const call = sendFn.mock.calls[0][0]
    expect(call.html).toContain('799.00')
  })

  it('includes the order ID in the email body', async () => {
    const sendFn = mockResend()
    mockSupabase()
    await sendPaymentReceivedEmail('user-1', 2, 10000, 'order_XYZ999')
    const call = sendFn.mock.calls[0][0]
    expect(call.html).toContain('order_XYZ999')
  })

  it('does not send when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    const sendFn = mockResend()
    mockSupabase()
    await sendPaymentReceivedEmail('user-1', 2, 10000, 'order_ABC')
    expect(sendFn).not.toHaveBeenCalled()
  })

  it('does not throw when course is not found', async () => {
    mockResend()
    mockSupabase({ noCourse: true })
    await expect(sendPaymentReceivedEmail('user-1', 999, 10000, 'order_ABC')).resolves.toBeUndefined()
  })

  it('does not throw when Resend.send rejects', async () => {
    mockResend(vi.fn().mockRejectedValue(new Error('timeout')))
    mockSupabase()
    await expect(sendPaymentReceivedEmail('user-1', 2, 10000, 'order_ABC')).resolves.toBeUndefined()
  })
})
