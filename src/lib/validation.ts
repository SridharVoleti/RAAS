import { z } from 'zod'
import { NextResponse } from 'next/server'

type ParseResult<T> = { success: true; data: T } | { success: false; response: NextResponse }

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<ParseResult<T>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return { success: false, response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }
  }
  const result = schema.safeParse(body)
  if (!result.success) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten().fieldErrors },
        { status: 400 }
      ),
    }
  }
  return { success: true, data: result.data }
}

// ── Payment ──────────────────────────────────────────────────────────────────

export const PaymentInitiateSchema = z.object({
  courseId: z.number().int().positive(),
  amount:   z.number().nonnegative(),
})

export const PaymentConfirmSchema = z.object({
  paymentLogId: z.number().int().positive(),
})

// ── Enrollment ───────────────────────────────────────────────────────────────

export const EnrollFreeSchema = z.object({
  courseId: z.number().int().positive(),
})

// ── Auth / OTP ────────────────────────────────────────────────────────────────

export const SendOtpSchema = z.object({
  mobile: z.string()
    .min(7, 'Mobile number too short')
    .max(15, 'Mobile number too long')
    .regex(/^\+?\d+$/, 'Must contain only digits (optional leading +)'),
})

export const VerifyOtpSchema = z.object({
  mobile: z.string().min(7).max(15),
  otp:    z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d+$/, 'OTP must be numeric'),
})

// ── Courses ───────────────────────────────────────────────────────────────────

const CourseBaseSchema = z.object({
  path_id:        z.number().int().positive(),
  slug:           z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  emoji:          z.string().max(10).optional(),
  bg_color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex colour').optional(),
  title_en:       z.string().min(2).max(200),
  title_te:       z.string().min(2).max(200),
  description_en: z.string().min(10).max(2000),
  description_te: z.string().min(10).max(2000),
  instructor_en:  z.string().min(2).max(100),
  instructor_te:  z.string().min(2).max(100),
  category:       z.string().min(1).max(100),
  level:          z.enum(['Beginner', 'Intermediate', 'Advanced']),
  badge:          z.string().max(50).nullable().optional(),
  duration:       z.string().max(50).optional(),
  is_free:        z.boolean().optional(),
  price:          z.number().nonnegative('Price cannot be negative').optional(),
  has_quiz:       z.boolean().optional(),
  order_index:    z.number().int().nonnegative().optional(),
  is_published:   z.boolean().optional(),
})

export const CreateCourseSchema = CourseBaseSchema
export const UpdateCourseSchema = CourseBaseSchema.partial()

// ── Lessons ───────────────────────────────────────────────────────────────────

const LessonBaseSchema = z.object({
  section_title:    z.string().max(100).nullable().optional(),
  title_en:         z.string().min(2).max(200),
  title_te:         z.string().max(200).nullable().optional(),
  youtube_video_id: z.string().min(5).max(20).regex(/^[a-zA-Z0-9_-]+$/, 'Must be a valid YouTube video ID'),
  duration:         z.string().max(20).nullable().optional(),
  order_index:      z.number().int().positive().optional(),
  is_preview:       z.boolean().optional(),
})

export const CreateLessonSchema = LessonBaseSchema
export const UpdateLessonSchema = LessonBaseSchema.extend({
  order_index: z.number().int().positive(),
})

// ── Email templates ───────────────────────────────────────────────────────────

export const EmailTemplateSchema = z.object({
  subject: z.string().min(1).max(200),
  body:    z.string().min(1).max(10000),
})
