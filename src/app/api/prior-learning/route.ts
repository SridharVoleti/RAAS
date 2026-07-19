import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, PriorLearningRegisterSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

// Guru-learning registration: a student declares RAAS subjects learnt from
// external gurus (one guru per subject) and is enrolled exam-only for the
// subjects that offer a final test.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, PriorLearningRegisterSchema)
  if (!parsed.success) return parsed.response
  const { subjects } = parsed.data

  const adminSupabase = createAdminClient()
  const courseIds = subjects.map(s => s.courseId)

  // Every subject must be a published RAAS-path course
  const { data: courses } = await adminSupabase
    .from('courses')
    .select('id, title_en, title_te, has_exam')
    .in('id', courseIds)
    .eq('is_published', true)
    .eq('path_id', 1)

  if (!courses || courses.length !== courseIds.length) {
    return NextResponse.json({ error: 'One or more subjects are not valid RAAS courses' }, { status: 400 })
  }
  const courseById = new Map(courses.map(c => [c.id, c]))

  // Reject subjects the student is already fully enrolled in — guru-learning
  // is only for subjects they haven't taken through RAAS
  const { data: existingEnrollments } = await adminSupabase
    .from('enrollments')
    .select('course_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('exam_only', false)
    .in('course_id', courseIds)

  if (existingEnrollments && existingEnrollments.length > 0) {
    return NextResponse.json({ error: 'You are already enrolled in one or more of these subjects' }, { status: 400 })
  }

  const now = new Date().toISOString()

  const declarations = subjects.map(s => ({
    user_id:        user.id,
    course_id:      s.courseId,
    teacher_name:   s.teacherName,
    teacher_mobile: s.teacherMobile,
    book_name:      courseById.get(s.courseId)!.title_en,
  }))

  const { error: declError } = await adminSupabase
    .from('prior_learning_declarations')
    .upsert(declarations, { onConflict: 'user_id,course_id' })

  if (declError) {
    logger.error({ error: declError.message, userId: user.id }, 'priorLearning.declarations.failed')
    return NextResponse.json({ error: 'Could not save your guru-learning details' }, { status: 500 })
  }

  const enrollments = subjects
    .filter(s => courseById.get(s.courseId)!.has_exam)
    .map(s => ({
      user_id:      user.id,
      course_id:    s.courseId,
      is_active:    true,
      exam_only:    true,
      activated_at: now,
    }))

  if (enrollments.length > 0) {
    const { error: enrollError } = await adminSupabase
      .from('enrollments')
      .upsert(enrollments, { onConflict: 'user_id,course_id' })

    if (enrollError) {
      logger.error({ error: enrollError.message, userId: user.id }, 'priorLearning.enroll.failed')
      return NextResponse.json({ error: 'Could not enroll you for the final test' }, { status: 500 })
    }
  }

  logger.info({ userId: user.id, courseIds }, 'priorLearning.registered')
  return NextResponse.json({
    subjects: subjects.map(s => {
      const c = courseById.get(s.courseId)!
      return { courseId: c.id, title_en: c.title_en, title_te: c.title_te, has_exam: c.has_exam }
    }),
  }, { status: 201 })
}

// The caller's declarations and course enrollments, so the dialog can mark
// registered subjects and hide the ones the student is already enrolled in
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data, error }, { data: enrollments, error: enrollError }] = await Promise.all([
    supabase
      .from('prior_learning_declarations')
      .select('course_id, teacher_name, teacher_mobile, created_at')
      .eq('user_id', user.id),
    supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .eq('exam_only', false),
  ])

  if (error) {
    logger.error({ error: error.message, userId: user.id }, 'priorLearning.own.list.failed')
    return NextResponse.json({ error: 'Failed to load your registrations' }, { status: 500 })
  }
  if (enrollError) {
    logger.error({ error: enrollError.message, userId: user.id }, 'priorLearning.own.enrollments.failed')
    return NextResponse.json({ error: 'Failed to load your enrollments' }, { status: 500 })
  }

  return NextResponse.json({
    declarations: data ?? [],
    enrolledCourseIds: (enrollments ?? []).map(e => e.course_id),
  })
}
