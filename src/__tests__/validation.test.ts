import { describe, it, expect } from 'vitest'
import {
  parseBody,
  PaymentInitiateSchema,
  PaymentConfirmSchema,
  EnrollFreeSchema,
  SendOtpSchema,
  VerifyOtpSchema,
  CreateCourseSchema,
  UpdateCourseSchema,
  CreateLessonSchema,
  UpdateLessonSchema,
  EmailTemplateSchema,
} from '@/lib/validation'

// ── parseBody ────────────────────────────────────────────────────────────────

describe('parseBody', () => {
  function makeJsonRequest(body: unknown) {
    return new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  function makeBadJsonRequest() {
    return new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    })
  }

  it('returns success:true with validated data for valid input', async () => {
    const req = makeJsonRequest({ courseId: 1 })
    const result = await parseBody(req, EnrollFreeSchema)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual({ courseId: 1 })
  })

  it('returns success:false with 400 response for invalid JSON', async () => {
    const req = makeBadJsonRequest()
    const result = await parseBody(req, EnrollFreeSchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
      const body = await result.response.json()
      expect(body.error).toBe('Invalid JSON body')
    }
  })

  it('returns success:false with 400 and field errors for schema mismatch', async () => {
    const req = makeJsonRequest({ courseId: 'not-a-number' })
    const result = await parseBody(req, EnrollFreeSchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.response.status).toBe(400)
      const body = await result.response.json()
      expect(body.error).toBe('Validation failed')
      expect(body.details).toBeDefined()
    }
  })
})

// ── PaymentInitiateSchema ────────────────────────────────────────────────────

describe('PaymentInitiateSchema', () => {
  it('accepts valid courseId and amount', () => {
    expect(PaymentInitiateSchema.safeParse({ courseId: 1, amount: 799 }).success).toBe(true)
  })

  it('accepts zero amount (free tier check)', () => {
    expect(PaymentInitiateSchema.safeParse({ courseId: 1, amount: 0 }).success).toBe(true)
  })

  it('rejects non-integer courseId', () => {
    expect(PaymentInitiateSchema.safeParse({ courseId: 1.5, amount: 100 }).success).toBe(false)
  })

  it('rejects negative courseId', () => {
    expect(PaymentInitiateSchema.safeParse({ courseId: -1, amount: 100 }).success).toBe(false)
  })

  it('rejects negative amount', () => {
    expect(PaymentInitiateSchema.safeParse({ courseId: 1, amount: -50 }).success).toBe(false)
  })
})

// ── PaymentConfirmSchema ─────────────────────────────────────────────────────

describe('PaymentConfirmSchema', () => {
  it('accepts positive integer paymentLogId', () => {
    expect(PaymentConfirmSchema.safeParse({ paymentLogId: 42 }).success).toBe(true)
  })

  it('rejects zero paymentLogId', () => {
    expect(PaymentConfirmSchema.safeParse({ paymentLogId: 0 }).success).toBe(false)
  })

  it('rejects string paymentLogId', () => {
    expect(PaymentConfirmSchema.safeParse({ paymentLogId: 'abc' }).success).toBe(false)
  })
})

// ── EnrollFreeSchema ─────────────────────────────────────────────────────────

describe('EnrollFreeSchema', () => {
  it('accepts positive integer courseId', () => {
    expect(EnrollFreeSchema.safeParse({ courseId: 5 }).success).toBe(true)
  })

  it('rejects zero courseId', () => {
    expect(EnrollFreeSchema.safeParse({ courseId: 0 }).success).toBe(false)
  })

  it('rejects missing courseId', () => {
    expect(EnrollFreeSchema.safeParse({}).success).toBe(false)
  })
})

// ── SendOtpSchema ────────────────────────────────────────────────────────────

describe('SendOtpSchema', () => {
  it('accepts valid 10-digit mobile', () => {
    expect(SendOtpSchema.safeParse({ mobile: '9876543210' }).success).toBe(true)
  })

  it('accepts mobile with leading +', () => {
    expect(SendOtpSchema.safeParse({ mobile: '+919876543210' }).success).toBe(true)
  })

  it('rejects mobile shorter than 7 chars', () => {
    expect(SendOtpSchema.safeParse({ mobile: '123456' }).success).toBe(false)
  })

  it('rejects mobile longer than 15 chars', () => {
    expect(SendOtpSchema.safeParse({ mobile: '1234567890123456' }).success).toBe(false)
  })

  it('rejects mobile with letters', () => {
    expect(SendOtpSchema.safeParse({ mobile: '+91abc12345' }).success).toBe(false)
  })
})

// ── VerifyOtpSchema ──────────────────────────────────────────────────────────

describe('VerifyOtpSchema', () => {
  it('accepts valid mobile and 6-digit OTP', () => {
    expect(VerifyOtpSchema.safeParse({ mobile: '9876543210', otp: '123456' }).success).toBe(true)
  })

  it('rejects OTP with fewer than 6 digits', () => {
    expect(VerifyOtpSchema.safeParse({ mobile: '9876543210', otp: '12345' }).success).toBe(false)
  })

  it('rejects OTP with more than 6 digits', () => {
    expect(VerifyOtpSchema.safeParse({ mobile: '9876543210', otp: '1234567' }).success).toBe(false)
  })

  it('rejects non-numeric OTP', () => {
    expect(VerifyOtpSchema.safeParse({ mobile: '9876543210', otp: '12345a' }).success).toBe(false)
  })
})

// ── CreateCourseSchema ───────────────────────────────────────────────────────

const validCourse = {
  path_id: 1,
  slug: 'my-course',
  title_en: 'My Course',
  title_te: 'నా కోర్సు',
  description_en: 'A course description here',
  description_te: 'కోర్సు వివరణ ఇక్కడ ఉంది',
  instructor_en: 'Teacher Name',
  instructor_te: 'ఉపాధ్యాయుని పేరు',
  category: 'Vedic',
  level: 'Beginner' as const,
}

describe('CreateCourseSchema', () => {
  it('accepts a valid course payload', () => {
    expect(CreateCourseSchema.safeParse(validCourse).success).toBe(true)
  })

  it('rejects invalid slug (uppercase)', () => {
    expect(CreateCourseSchema.safeParse({ ...validCourse, slug: 'My-Course' }).success).toBe(false)
  })

  it('rejects invalid slug (spaces)', () => {
    expect(CreateCourseSchema.safeParse({ ...validCourse, slug: 'my course' }).success).toBe(false)
  })

  it('rejects invalid level value', () => {
    expect(CreateCourseSchema.safeParse({ ...validCourse, level: 'Expert' }).success).toBe(false)
  })

  it('rejects invalid hex bg_color', () => {
    expect(CreateCourseSchema.safeParse({ ...validCourse, bg_color: 'red' }).success).toBe(false)
  })

  it('accepts valid hex bg_color', () => {
    expect(CreateCourseSchema.safeParse({ ...validCourse, bg_color: '#1a0f00' }).success).toBe(true)
  })

  it('rejects negative price', () => {
    expect(CreateCourseSchema.safeParse({ ...validCourse, price: -10 }).success).toBe(false)
  })

  it('accepts all three valid levels', () => {
    for (const level of ['Beginner', 'Intermediate', 'Advanced'] as const) {
      expect(CreateCourseSchema.safeParse({ ...validCourse, level }).success).toBe(true)
    }
  })
})

describe('UpdateCourseSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(UpdateCourseSchema.safeParse({}).success).toBe(true)
  })

  it('accepts partial update', () => {
    expect(UpdateCourseSchema.safeParse({ title_en: 'New Title' }).success).toBe(true)
  })

  it('still rejects invalid slug when provided', () => {
    expect(UpdateCourseSchema.safeParse({ slug: 'Invalid Slug!' }).success).toBe(false)
  })
})

// ── CreateLessonSchema ───────────────────────────────────────────────────────

const validLesson = {
  title_en: 'Introduction',
  youtube_video_id: 'dQw4w9WgXcQ',
}

describe('CreateLessonSchema', () => {
  it('accepts a valid lesson with required fields', () => {
    expect(CreateLessonSchema.safeParse(validLesson).success).toBe(true)
  })

  it('rejects invalid youtube_video_id with special chars', () => {
    expect(CreateLessonSchema.safeParse({ ...validLesson, youtube_video_id: 'bad id!' }).success).toBe(false)
  })

  it('rejects youtube_video_id shorter than 5 chars', () => {
    expect(CreateLessonSchema.safeParse({ ...validLesson, youtube_video_id: 'abc' }).success).toBe(false)
  })

  it('rejects a lesson with no title in either language', () => {
    expect(CreateLessonSchema.safeParse({ ...validLesson, title_en: '' }).success).toBe(false)
  })

  it('accepts a lesson with only a Telugu title', () => {
    expect(CreateLessonSchema.safeParse({ ...validLesson, title_en: '', title_te: 'పరిచయం' }).success).toBe(true)
  })
})

describe('UpdateLessonSchema', () => {
  it('requires order_index', () => {
    expect(UpdateLessonSchema.safeParse(validLesson).success).toBe(false)
  })

  it('accepts lesson with order_index', () => {
    expect(UpdateLessonSchema.safeParse({ ...validLesson, order_index: 1 }).success).toBe(true)
  })
})

// ── EmailTemplateSchema ──────────────────────────────────────────────────────

describe('EmailTemplateSchema', () => {
  it('accepts valid subject and body', () => {
    expect(EmailTemplateSchema.safeParse({ subject: 'Hello', body: 'World' }).success).toBe(true)
  })

  it('rejects empty subject', () => {
    expect(EmailTemplateSchema.safeParse({ subject: '', body: 'Body' }).success).toBe(false)
  })

  it('rejects empty body', () => {
    expect(EmailTemplateSchema.safeParse({ subject: 'Sub', body: '' }).success).toBe(false)
  })

  it('rejects body over 10000 chars', () => {
    expect(EmailTemplateSchema.safeParse({ subject: 'Sub', body: 'x'.repeat(10001) }).success).toBe(false)
  })
})
