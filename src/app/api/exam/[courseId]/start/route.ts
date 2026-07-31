import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  COOLDOWN_HOURS,
  EXAM_ONLY_DURATION_MINUTES,
  EXAM_ONLY_MAX_ATTEMPTS,
  EXAM_ONLY_QUESTION_TARGET,
  countExamOnlyFailedAttempts,
  ensureExamOnlyEnrollment,
  fetchQuestionPage,
} from '@/lib/exam'

const QUESTIONS_PER_CHAPTER = 5

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

  // Verify enrollment (self-heals a missing exam_only enrollment if the student
  // declared prior learning before the course's has_exam flag was turned on)
  const enrollment = await ensureExamOnlyEnrollment(adminSupabase, user.id, courseIdNum)

  if (!enrollment?.is_active) {
    return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
  }

  if (enrollment.exam_only) {
    // Prior-learning students get up to EXAM_ONLY_MAX_ATTEMPTS attempts: once that many
    // submitted sessions have failed, re-attempts are blocked until they take the course.
    const failedCount = await countExamOnlyFailedAttempts(supabase, user.id, courseIdNum)

    if (failedCount >= EXAM_ONLY_MAX_ATTEMPTS) {
      return NextResponse.json({
        error:   'must_take_course',
        message: `You have used your ${EXAM_ONLY_MAX_ATTEMPTS} attempts at the final test. We kindly request you to take this course on the site before attempting the exam again.`,
      }, { status: 403 })
    }
  } else {
    // Regular course students: 48h cooldown after a failed attempt
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
  }

  // Abandon any stale in-progress session
  await adminSupabase
    .from('exam_sessions')
    .update({ status: 'submitted', score: 0, passed: false, submitted_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .eq('status', 'in_progress')

  // Build question sequence from the bank, grouped by chapter_name
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

  function shuffle(pool: number[]): number[] {
    return pool.slice().sort(() => Math.random() - 0.5)
  }

  // Named chapters first (sorted alphabetically), then uncategorized
  const chapterOrder = [...byChapter.keys()].filter(k => k !== '').sort()
  if (byChapter.has('')) chapterOrder.push('')

  const fullSequence: number[] = []

  if (enrollment.exam_only) {
    // Prior-learning final test: 100 questions drawn round-robin across chapters
    // for equal weightage. Not every course has a 100-question bank — if it has
    // fewer, the paper is half the available bank (rounded up), not the whole
    // thing, so a 50-question course gets a 25-question paper, not a 50-question one.
    const target = allQRows.length >= EXAM_ONLY_QUESTION_TARGET
      ? EXAM_ONLY_QUESTION_TARGET
      : Math.ceil(allQRows.length / 2)
    const pools = chapterOrder.map(name => shuffle(byChapter.get(name)!))
    const picked: number[][] = pools.map(() => [])
    let total = 0
    for (let round = 0; total < target; round++) {
      let took = false
      for (let c = 0; c < pools.length && total < target; c++) {
        if (round < pools[c].length) {
          picked[c].push(pools[c][round])
          total++
          took = true
        }
      }
      if (!took) break
    }
    for (const chapterPicks of picked) fullSequence.push(...chapterPicks)
  } else {
    // Regular course students: fixed questions per chapter
    for (const name of chapterOrder) {
      fullSequence.push(...shuffle(byChapter.get(name)!).slice(0, QUESTIONS_PER_CHAPTER))
    }
  }

  if (fullSequence.length === 0) {
    return NextResponse.json({ error: 'No exam questions available for this course yet' }, { status: 503 })
  }

  // Create session with the full pre-built sequence; exam-only sessions carry a 100-minute timer
  const sessionType = enrollment.exam_only ? 'exam_only' : 'course'
  const expiresAt = enrollment.exam_only
    ? new Date(Date.now() + EXAM_ONLY_DURATION_MINUTES * 60 * 1000).toISOString()
    : null

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
      expires_at:         expiresAt,
    })
    .select()
    .single()

  if (sessionError || !session) {
    logger.error({ error: sessionError?.message, userId: user.id }, 'exam.session.create.failed')
    return NextResponse.json({ error: 'Failed to create exam session' }, { status: 500 })
  }

  const firstPage = await fetchQuestionPage(adminSupabase, fullSequence, 0, expiresAt)
  if (!firstPage) {
    return NextResponse.json({ error: 'Could not load first page of questions' }, { status: 500 })
  }

  logger.info({ userId: user.id, courseId: courseIdNum, sessionId: session.id, total: fullSequence.length }, 'exam.session.started')

  return NextResponse.json({ session_id: session.id, ...firstPage })
}
