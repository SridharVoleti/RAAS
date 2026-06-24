import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { ExamQuestion_Public, ExamNextQuestion } from '@/types'

const EXAM_LENGTH = 60
const PASS_THRESHOLD = 0.70
const COOLDOWN_HOURS = 48

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params
  const courseIdNum = Number(courseId)

  const adminSupabase = await createAdminClient()

  // Verify course exists and has_exam
  const { data: course } = await adminSupabase
    .from('courses')
    .select('id, has_exam, title_en')
    .eq('id', courseIdNum)
    .single()

  if (!course?.has_exam) {
    return NextResponse.json({ error: 'This course does not have an exam' }, { status: 404 })
  }

  // Verify enrollment (full course or exam_only)
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('is_active, exam_only')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .maybeSingle()

  if (!enrollment?.is_active) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
  }

  // Check 48h cooldown: any failed session in last 48h
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
  const { data: recentFailed } = await supabase
    .from('exam_sessions')
    .select('submitted_at')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .eq('status', 'submitted')
    .eq('passed', false)
    .gt('submitted_at', cooldownCutoff)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentFailed) {
    const nextAllowed = new Date(
      new Date(recentFailed.submitted_at).getTime() + COOLDOWN_HOURS * 60 * 60 * 1000
    )
    return NextResponse.json({
      error: 'cooldown',
      message: `You must wait ${COOLDOWN_HOURS} hours before retaking. Next attempt allowed after ${nextAllowed.toISOString()}`,
      nextAllowedAt: nextAllowed.toISOString(),
    }, { status: 429 })
  }

  // Abandon any stale in-progress session
  await adminSupabase
    .from('exam_sessions')
    .update({ status: 'submitted', score: 0, passed: false, submitted_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .eq('status', 'in_progress')

  // Verify enough questions exist
  const { count: questionCount } = await adminSupabase
    .from('exam_questions')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseIdNum)

  if (!questionCount || questionCount < EXAM_LENGTH) {
    return NextResponse.json({
      error: `Exam bank has only ${questionCount ?? 0} questions. ${EXAM_LENGTH} required.`
    }, { status: 503 })
  }

  // Create new session
  const sessionType = enrollment.exam_only ? 'exam_only' : 'course'
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .insert({
      user_id:            user.id,
      course_id:          courseIdNum,
      session_type:       sessionType,
      status:             'in_progress',
      question_sequence:  [],
      answers:            {},
      current_difficulty: 2,
      questions_answered: 0,
    })
    .select()
    .single()

  if (sessionError || !session) {
    logger.error({ error: sessionError?.message, userId: user.id }, 'exam.session.create.failed')
    return NextResponse.json({ error: 'Failed to create exam session' }, { status: 500 })
  }

  // Pick first question at difficulty 2 (medium)
  const firstQuestion = await pickQuestion(adminSupabase, courseIdNum, 2, [])
  if (!firstQuestion) {
    return NextResponse.json({ error: 'Could not select a question' }, { status: 500 })
  }

  // Update session with first question in sequence
  await adminSupabase
    .from('exam_sessions')
    .update({ question_sequence: [firstQuestion.id] })
    .eq('id', session.id)

  logger.info({ userId: user.id, courseId: courseIdNum, sessionId: session.id }, 'exam.session.started')

  const { correct_option: _omit, ...publicQuestion } = firstQuestion
  const response: ExamNextQuestion = {
    question:         publicQuestion as ExamQuestion_Public,
    question_number:  1,
    total_questions:  EXAM_LENGTH,
    done:             false,
  }

  return NextResponse.json({ session_id: session.id, ...response })
}

async function pickQuestion(
  supabase: ReturnType<typeof createAdminClient>,
  courseId: number,
  difficulty: number,
  usedIds: number[]
) {
  // Try exact difficulty first, then adjacent if unavailable
  for (const diff of getCandidateDifficulties(difficulty)) {
    let query = supabase
      .from('exam_questions')
      .select('*')
      .eq('course_id', courseId)
      .eq('difficulty', diff)

    if (usedIds.length > 0) {
      query = query.not('id', 'in', `(${usedIds.join(',')})`)
    }

    const { data } = await query
    if (data && data.length > 0) {
      return data[Math.floor(Math.random() * data.length)]
    }
  }
  return null
}

function getCandidateDifficulties(target: number): number[] {
  if (target === 1) return [1, 2]
  if (target === 3) return [3, 2]
  return [2, 1, 3]
}
