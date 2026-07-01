import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { ExamQuestion_Public, ExamNextQuestion } from '@/types'

const QUESTIONS_PER_CHAPTER = 5
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

  // Verify course exists
  const { data: course } = await adminSupabase
    .from('courses')
    .select('id, title_en')
    .eq('id', courseIdNum)
    .single()

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  // Verify enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('is_active, exam_only')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .maybeSingle()

  if (!enrollment?.is_active) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
  }

  // Check 48h cooldown
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

  // Build question sequence: 5 random per chapter_name (alphabetical order)
  const { data: allQRows } = await adminSupabase
    .from('exam_questions')
    .select('id, chapter_name')
    .eq('course_id', courseIdNum)

  if (!allQRows || allQRows.length === 0) {
    return NextResponse.json({ error: 'No exam questions available for this course yet' }, { status: 503 })
  }

  // Group question IDs by chapter_name (null/blank → 'Uncategorized')
  const byChapter = new Map<string, number[]>()
  for (const q of allQRows) {
    const key = q.chapter_name?.trim() || ''
    const arr = byChapter.get(key) ?? []
    arr.push(q.id)
    byChapter.set(key, arr)
  }

  function shufflePick(pool: number[], n: number): number[] {
    const shuffled = pool.slice().sort(() => Math.random() - 0.5)
    return shuffled.slice(0, n)
  }

  const fullSequence: number[] = []

  // Named chapters first (sorted alphabetically), then uncategorized
  const namedChapters = [...byChapter.keys()].filter(k => k !== '').sort()
  for (const name of namedChapters) {
    fullSequence.push(...shufflePick(byChapter.get(name)!, QUESTIONS_PER_CHAPTER))
  }
  const noChapter = byChapter.get('') ?? []
  if (noChapter.length > 0) fullSequence.push(...shufflePick(noChapter, QUESTIONS_PER_CHAPTER))

  if (fullSequence.length === 0) {
    return NextResponse.json({ error: 'No exam questions available for this course yet' }, { status: 503 })
  }

  // Create session with the full pre-built sequence
  const sessionType = enrollment.exam_only ? 'exam_only' : 'course'
  const { data: session, error: sessionError } = await supabase
    .from('exam_sessions')
    .insert({
      user_id:            user.id,
      course_id:          courseIdNum,
      session_type:       sessionType,
      status:             'in_progress',
      question_sequence:  fullSequence,
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

  // Fetch first question
  const { data: firstQuestion } = await adminSupabase
    .from('exam_questions')
    .select('*')
    .eq('id', fullSequence[0])
    .single()

  if (!firstQuestion) {
    return NextResponse.json({ error: 'Could not load first question' }, { status: 500 })
  }

  logger.info({ userId: user.id, courseId: courseIdNum, sessionId: session.id, total: fullSequence.length }, 'exam.session.started')

  const { correct_option: _omit, ...publicQuestion } = firstQuestion
  const response: ExamNextQuestion = {
    question:        publicQuestion as ExamQuestion_Public,
    question_number: 1,
    total_questions: fullSequence.length,
    done:            false,
  }

  return NextResponse.json({ session_id: session.id, ...response })
}
