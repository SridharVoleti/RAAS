import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, ExamEnrollSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, ExamEnrollSchema)
  if (!parsed.success) return parsed.response
  const { courseId, teacherName, teacherMobile, bookName } = parsed.data

  const adminSupabase = await createAdminClient()

  // Verify course exists and has_exam enabled
  const { data: course } = await adminSupabase
    .from('courses')
    .select('id, has_exam, is_published, title_en')
    .eq('id', courseId)
    .eq('is_published', true)
    .single()

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  if (!course.has_exam) {
    return NextResponse.json({ error: 'This course does not offer an exam-only option' }, { status: 400 })
  }

  // Record the prior-learning declaration (who the student's guru was)
  const { error: declError } = await adminSupabase
    .from('prior_learning_declarations')
    .upsert({
      user_id:        user.id,
      course_id:      courseId,
      teacher_name:   teacherName,
      teacher_mobile: teacherMobile,
      book_name:      bookName,
    }, { onConflict: 'user_id,course_id' })

  if (declError) {
    logger.error({ error: declError.message, userId: user.id, courseId }, 'exam.enroll.declaration.failed')
    return NextResponse.json({ error: 'Could not save your prior-learning details' }, { status: 500 })
  }

  // Upsert enrollment as exam_only + active
  const { data: existing } = await supabase
    .from('enrollments')
    .select('id, is_active, exam_only')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()

  if (existing?.is_active) {
    return NextResponse.json({
      message:    existing.exam_only ? 'Already enrolled for exam' : 'Already fully enrolled',
      enrollment: existing,
    })
  }

  const now = new Date().toISOString()

  const { data: enrollment, error } = await adminSupabase
    .from('enrollments')
    .upsert({
      user_id:      user.id,
      course_id:    courseId,
      is_active:    true,
      exam_only:    true,
      activated_at: now,
    }, { onConflict: 'user_id,course_id' })
    .select()
    .single()

  if (error) {
    logger.error({ error: error.message, userId: user.id, courseId }, 'exam.enroll.failed')
    return NextResponse.json({ error: 'Enrollment failed' }, { status: 500 })
  }

  logger.info({ userId: user.id, courseId, courseTitle: course.title_en }, 'exam.enroll.created')
  return NextResponse.json({ enrollment }, { status: 201 })
}
