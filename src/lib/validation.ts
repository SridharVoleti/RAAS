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

// ── International course purchase (non-Indian students, manual bank/QR payment) ──

export const CoursePurchaseInitiateSchema = z.object({
  courseId:  z.number().int().positive(),
  reference: z.string().max(200).optional(),
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
  duration:       z.string().max(50).optional(),
  is_free:        z.boolean().optional(),
  price:          z.number().nonnegative('Price cannot be negative').optional(),
  has_quiz:       z.boolean().optional(),
  has_exam:       z.boolean().optional(),
  order_index:    z.number().int().nonnegative().optional(),
  is_published:   z.boolean().optional(),
  resources:      z.array(z.object({
    title: z.string().trim().min(1).max(200),
    url:   z.string().trim().url().max(2000),
  })).max(50).optional(),
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

export const CourseRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
})

// ── Exam ──────────────────────────────────────────────────────────────────────

const ExamQuestionBaseSchema = z.object({
  course_id:    z.number().int().positive(),
  chapter_id:   z.number().int().positive().optional(),
  chapter_name: z.string().max(200).optional(),
  question_te:    z.string().min(1).max(2000),
  option_a_te:    z.string().min(1).max(500),
  option_b_te:    z.string().min(1).max(500),
  option_c_te:    z.string().min(1).max(500),
  option_d_te:    z.string().min(1).max(500),
  correct_option: z.enum(['a', 'b', 'c', 'd']),
})

export const CreateExamQuestionSchema = ExamQuestionBaseSchema
export const UpdateExamQuestionSchema = ExamQuestionBaseSchema.partial().extend({
  correct_option: z.enum(['a', 'b', 'c', 'd']).optional(),
})

export const ExamAnswerSchema = z.object({
  session_id: z.string().uuid(),
  question_id: z.number().int().positive(),
  answer: z.enum(['a', 'b', 'c', 'd']),
})

export const ExamPageAnswerSchema = z.object({
  session_id: z.string().uuid(),
  // Empty array is allowed: an expired session is flushed with no new answers
  answers: z.array(z.object({
    question_id: z.number().int().positive(),
    answer: z.enum(['a', 'b', 'c', 'd']),
  })).max(10),
})

export const ExamEnrollSchema = z.object({
  courseId:      z.number().int().positive(),
  teacherName:   z.string().trim().min(1, 'Guru name is required').max(200),
  teacherMobile: z.string().regex(/^\+?\d{7,15}$/, 'Invalid mobile number'),
  bookName:      z.string().trim().min(1, 'Book / text name is required').max(200),
})

// ── Learning paths ────────────────────────────────────────────────────────────

const PathFieldsSchema = z.object({
  slug:           z.string().regex(/^[a-z0-9-]+$/, 'Lowercase letters, digits and hyphens only').min(2).max(50),
  name:           z.string().trim().min(1).max(50),
  full_name_en:   z.string().trim().max(200),
  full_name_te:   z.string().trim().max(200),
  tagline_en:     z.string().trim().max(500),
  tagline_te:     z.string().trim().max(500),
  description_en: z.string().trim().max(500),
  description_te: z.string().trim().max(500),
  emoji:          z.string().min(1).max(8),
  is_active:      z.boolean(),
  order_index:    z.number().int().nonnegative(),
  certificates_enabled: z.boolean(),
})

export const PathSchema = PathFieldsSchema.extend({
  full_name_en:   PathFieldsSchema.shape.full_name_en.optional().default(''),
  full_name_te:   PathFieldsSchema.shape.full_name_te.optional().default(''),
  tagline_en:     PathFieldsSchema.shape.tagline_en.optional().default(''),
  tagline_te:     PathFieldsSchema.shape.tagline_te.optional().default(''),
  description_en: PathFieldsSchema.shape.description_en.optional().default(''),
  description_te: PathFieldsSchema.shape.description_te.optional().default(''),
  emoji:          PathFieldsSchema.shape.emoji.optional().default('🕉️'),
  is_active:      PathFieldsSchema.shape.is_active.optional().default(true),
  order_index:    PathFieldsSchema.shape.order_index.optional().default(0),
  certificates_enabled: PathFieldsSchema.shape.certificates_enabled.optional().default(false),
})

// Partial update WITHOUT defaults — a PUT must never reset omitted fields
export const PathUpdateSchema = PathFieldsSchema.partial()

// ── Prior learning (guru) registration ────────────────────────────────────────

export const PriorLearningRegisterSchema = z.object({
  subjects: z.array(z.object({
    courseId:      z.number().int().positive(),
    teacherName:   z.string().trim().min(2, 'Guru name is too short').max(200),
    teacherMobile: z.string().regex(/^\+?\d{7,15}$/, 'Invalid mobile number'),
  })).min(1).max(50)
    .refine(
      subjects => new Set(subjects.map(s => s.courseId)).size === subjects.length,
      { message: 'Duplicate subjects in request' }
    ),
})

// ── Testimonials (Student Voices) ─────────────────────────────────────────────

export const TestimonialSubmitSchema = z.object({
  reviewerName: z.string().trim().min(2, 'Name is too short').max(100),
  message:      z.string().trim().min(10, 'Please write at least 10 characters').max(1000),
  rating:       z.number().int().min(1).max(5),
  courseId:     z.number().int().positive().optional(),
})

// ── Course Q&A ───────────────────────────────────────────────────────────────

export const CreateQuestionSchema = z.object({
  body: z.string().trim().min(1, 'Question cannot be empty').max(2000),
})

export const CreateAnswerSchema = z.object({
  body: z.string().trim().min(1, 'Answer cannot be empty').max(2000),
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

// Admin editing another student's profile — more lenient than self-service UpdateProfileSchema
// since this is a data-correction tool, not the registration form.
export const AdminUpdateProfileSchema = z.object({
  full_name:       z.string().min(1).max(100).optional(),
  username:        z.string().max(50).nullable().optional(),
  fathers_name:    z.string().max(100).nullable().optional(),
  address:         z.string().max(300).nullable().optional(),
  referral_source: z.string().max(200).nullable().optional(),
  mobile:          z.string().max(20).nullable().optional(),
  isd_code:        z.string().max(10).optional(),
  city:            z.string().max(100).nullable().optional(),
  country:         z.string().min(1).max(100).optional(),
  student_id:      z.number().int().positive().nullable().optional(),
  preferred_lang:  z.enum(['en', 'te']).optional(),
})

// ── Mobile / login helpers ────────────────────────────────────────────────────
// These are pure functions with no framework imports — safe to use anywhere.

export const MOBILE_AUTH_DOMAIN = 'mobile.srikrishnamargam.in'

/** Strip every character that isn't a digit. */
export function normalizeMobileDigits(input: string): string {
  return input.replace(/\D/g, '')
}

/**
 * Combine an ISD code with a raw mobile number into one canonical digit
 * string. Tolerates a country code that's already present in the mobile
 * field itself (e.g. a mobile-browser autofilling the full international
 * number into a field meant to hold the local number only — the ISD would
 * otherwise get counted twice) and a domestic trunk zero (e.g. "09876543210").
 * isd='+91', mobile='9876543210' → '919876543210'
 */
export function toFullMobileDigits(isd: string, mobile: string): string {
  const isdDigits = normalizeMobileDigits(isd) || '91'
  let digits = normalizeMobileDigits(mobile)

  // Mobile field already includes the country code — don't double it up.
  if (digits.startsWith(isdDigits) && digits.length > isdDigits.length + 6) {
    digits = digits.slice(isdDigits.length)
  }

  if (digits.length > 10 && digits.startsWith('0')) {
    digits = digits.replace(/^0+/, '')
  }

  return `${isdDigits}${digits}`
}

/**
 * Build the synthetic Supabase auth email for a mobile-only account.
 * isd='+91', mobile='9876543210' → '919876543210@mobile.srikrishnamargam.in'
 */
export function mobileToSyntheticEmail(isd: string, mobile: string): string {
  return `${toFullMobileDigits(isd, mobile)}@${MOBILE_AUTH_DOMAIN}`
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
