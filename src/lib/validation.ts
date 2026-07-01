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
  title_en:       z.string().max(200).optional().default(''),
  title_te:       z.string().max(200).optional().default(''),
  description_en: z.string().max(5000).optional().default(''),
  description_te: z.string().max(5000).optional().default(''),
  instructor_en:  z.string().max(100).optional().default(''),
  instructor_te:  z.string().max(100).optional().default(''),
  category:       z.string().min(1).max(100),
  level:          z.enum(['Beginner', 'Intermediate', 'Advanced']),
  badge:          z.string().max(50).nullable().optional(),
  duration:       z.string().max(50).optional(),
  is_free:        z.boolean().optional(),
  price:          z.number().nonnegative('Price cannot be negative').optional(),
  has_quiz:       z.boolean().optional(),
  has_exam:       z.boolean().optional(),
  order_index:    z.number().int().nonnegative().optional(),
  is_published:   z.boolean().optional(),
})

export const CreateCourseSchema = CourseBaseSchema
  .refine(d => d.title_en?.trim() || d.title_te?.trim(),
    { message: 'At least one language title (English or Telugu) is required', path: ['title_en'] })
  .refine(d => d.description_en?.trim() || d.description_te?.trim(),
    { message: 'At least one language description is required', path: ['description_en'] })
export const UpdateCourseSchema = CourseBaseSchema.partial()

// ── Lessons ───────────────────────────────────────────────────────────────────

const LessonBaseSchema = z.object({
  chapter_id:       z.number().int().positive().nullable().optional(),
  section_title:    z.string().max(100).nullable().optional(),
  title_en:         z.string().max(200).optional().default(''),
  title_te:         z.string().max(200).nullable().optional(),
  youtube_video_id: z.string().min(5).max(20).regex(/^[a-zA-Z0-9_-]+$/, 'Must be a valid YouTube video ID'),
  duration:         z.string().max(20).nullable().optional(),
  order_index:      z.number().int().positive().optional(),
  is_preview:       z.boolean().optional(),
})

export const CreateLessonSchema = LessonBaseSchema
  .refine(d => d.title_en?.trim() || d.title_te?.trim(),
    { message: 'At least one language title (English or Telugu) is required', path: ['title_en'] })
export const UpdateLessonSchema = LessonBaseSchema.extend({
  order_index: z.number().int().positive(),
})

// ── Chapters ──────────────────────────────────────────────────

const ChapterBaseSchema = z.object({
  title_en:    z.string().max(200).optional().default(''),
  title_te:    z.string().max(200).optional().default(''),
  order_index: z.number().int().nonnegative().optional(),
})

export const CreateChapterSchema = ChapterBaseSchema
  .refine(d => d.title_en?.trim() || d.title_te?.trim(),
    { message: 'At least one language title (English or Telugu) is required', path: ['title_en'] })
export const UpdateChapterSchema = ChapterBaseSchema.partial()

// ── Quiz ─────────────────────────────────────────────────────────────────────

const QuizQuestionBaseSchema = z.object({
  question_en:    z.string().max(1000).optional().default(''),
  question_te:    z.string().max(1000).optional().default(''),
  option_a_en:    z.string().max(500).optional().default(''),
  option_a_te:    z.string().max(500).optional().default(''),
  option_b_en:    z.string().max(500).optional().default(''),
  option_b_te:    z.string().max(500).optional().default(''),
  option_c_en:    z.string().max(500).optional().default(''),
  option_c_te:    z.string().max(500).optional().default(''),
  option_d_en:    z.string().max(500).optional().default(''),
  option_d_te:    z.string().max(500).optional().default(''),
  correct_option: z.enum(['a', 'b', 'c', 'd']),
  order_index:    z.number().int().nonnegative().optional(),
})

function refineQuizBilingual(
  d: z.infer<typeof QuizQuestionBaseSchema>,
  ctx: z.RefinementCtx
) {
  if (!d.question_en?.trim() && !d.question_te?.trim())
    ctx.addIssue({ code: 'custom', message: 'At least one language question is required', path: ['question_en'] })
  for (const opt of ['a', 'b', 'c', 'd'] as const) {
    const en = d[`option_${opt}_en` as keyof typeof d] as string | undefined
    const te = d[`option_${opt}_te` as keyof typeof d] as string | undefined
    if (!en?.trim() && !te?.trim())
      ctx.addIssue({ code: 'custom', message: `At least one language text for option ${opt} is required`, path: [`option_${opt}_en`] })
  }
}

export const CreateQuizQuestionSchema = QuizQuestionBaseSchema.superRefine(refineQuizBilingual)
export const UpdateQuizQuestionSchema = QuizQuestionBaseSchema.partial().extend({
  correct_option: z.enum(['a', 'b', 'c', 'd']),
  lesson_id:      z.number().int().positive().optional(),
  chapter_id:     z.number().int().positive().optional(),
})

export const QuizSubmitSchema = z.object({
  answers: z.record(z.string(), z.enum(['a', 'b', 'c', 'd'])),
})

// ── Exam ──────────────────────────────────────────────────────────────────────

const ExamQuestionBaseSchema = z.object({
  course_id:      z.number().int().positive(),
  difficulty:     z.union([z.literal(1), z.literal(2), z.literal(3)]),
  question_en:    z.string().max(2000).optional().default(''),
  question_te:    z.string().max(2000).optional().default(''),
  option_a_en:    z.string().max(500).optional().default(''),
  option_a_te:    z.string().max(500).optional().default(''),
  option_b_en:    z.string().max(500).optional().default(''),
  option_b_te:    z.string().max(500).optional().default(''),
  option_c_en:    z.string().max(500).optional().default(''),
  option_c_te:    z.string().max(500).optional().default(''),
  option_d_en:    z.string().max(500).optional().default(''),
  option_d_te:    z.string().max(500).optional().default(''),
  correct_option: z.enum(['a', 'b', 'c', 'd']),
})

function refineExamBilingual(
  d: z.infer<typeof ExamQuestionBaseSchema>,
  ctx: z.RefinementCtx
) {
  if (!d.question_en?.trim() && !d.question_te?.trim())
    ctx.addIssue({ code: 'custom', message: 'At least one language question is required', path: ['question_en'] })
  for (const opt of ['a', 'b', 'c', 'd'] as const) {
    const en = d[`option_${opt}_en` as keyof typeof d] as string | undefined
    const te = d[`option_${opt}_te` as keyof typeof d] as string | undefined
    if (!en?.trim() && !te?.trim())
      ctx.addIssue({ code: 'custom', message: `At least one language text for option ${opt} is required`, path: [`option_${opt}_en`] })
  }
}

export const CreateExamQuestionSchema = ExamQuestionBaseSchema.superRefine(refineExamBilingual)
export const UpdateExamQuestionSchema = ExamQuestionBaseSchema.partial().extend({
  correct_option: z.enum(['a', 'b', 'c', 'd']).optional(),
})

export const ExamAnswerSchema = z.object({
  session_id: z.string().uuid(),
  question_id: z.number().int().positive(),
  answer: z.enum(['a', 'b', 'c', 'd']),
})

export const ExamEnrollSchema = z.object({
  courseId: z.number().int().positive(),
})

// ── Email templates ───────────────────────────────────────────────────────────

export const EmailTemplateSchema = z.object({
  subject: z.string().min(1).max(200),
  body:    z.string().min(1).max(10000),
})

// ── Profile ───────────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  full_name: z.string().min(2).max(100).optional(),
  city:      z.string().min(1).max(100).optional(),
  country:   z.string().min(1).max(100).optional(),
  mobile:    z.string().regex(/^\+?\d{7,15}$/, 'Invalid mobile number').optional(),
  isd_code:  z.string().max(10).optional(),
  preferred_lang: z.enum(['en', 'te']).optional(),
})

export const ChangePasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

// ── Mobile / login helpers ────────────────────────────────────────────────────
// These are pure functions with no framework imports — safe to use anywhere.

export const MOBILE_AUTH_DOMAIN = 'mobile.srikrishnamargam.in'

/** Strip every character that isn't a digit. */
export function normalizeMobileDigits(input: string): string {
  return input.replace(/\D/g, '')
}

/**
 * Build the synthetic Supabase auth email for a mobile-only account.
 * isd='+91', mobile='9876543210' → '919876543210@mobile.krishnamargam.in'
 */
export function mobileToSyntheticEmail(isd: string, mobile: string): string {
  const digits = normalizeMobileDigits(`${isd}${mobile}`)
  return `${digits}@${MOBILE_AUTH_DOMAIN}`
}

/**
 * Normalise a raw login username (mobile number) to digits, auto-prepending
 * the India country code (91) when the input is exactly 10 digits.
 */
export function normalizeLoginMobile(input: string): string {
  const digits = normalizeMobileDigits(input)
  return digits.length === 10 ? `91${digits}` : digits
}

/**
 * Convert a login username that looks like a mobile number into the
 * corresponding synthetic auth email.
 */
export function loginMobileToSyntheticEmail(input: string): string {
  return `${normalizeLoginMobile(input)}@${MOBILE_AUTH_DOMAIN}`
}

/** Returns true when an email was generated by mobileToSyntheticEmail. */
export function isSyntheticEmail(email: string): boolean {
  return email.endsWith(`@${MOBILE_AUTH_DOMAIN}`)
}

/**
 * Returns true when the login input looks like a mobile number rather than
 * an email address (no '@', contains only digits / spaces / dashes / parens).
 */
export function looksLikeMobile(input: string): boolean {
  const s = input.trim()
  return !s.includes('@') && /^\+?[\d\s\-().]{7,20}$/.test(s)
}
