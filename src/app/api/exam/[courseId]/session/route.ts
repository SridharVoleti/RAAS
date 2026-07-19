import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { COOLDOWN_HOURS, EXAM_ONLY_QUESTION_TARGET, ensureExamOnlyEnrollment, fetchQuestionPage, gradeAndFinalize, isExpired } from '@/lib/exam'
import type { ExamQuestionPage } from '@/types'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params
  const courseIdNum = Number(courseId)

  const adminSupabase = await createAdminClient()

  // Bank size determines the final-test question count shown in the disclaimer (capped at 100)
  const { count: bankCount } = await adminSupabase
    .from('exam_questions')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', courseIdNum)

  // Check enrollment (self-heals a missing exam_only enrollment if the student
  // declared prior learning before the course's has_exam flag was turned on)
  const enrollment = await ensureExamOnlyEnrollment(adminSupabase, user.id, courseIdNum)

  const examOnly = enrollment?.exam_only ?? false

  // Exam-only students: a failed submitted attempt permanently blocks re-attempts
  let mustTakeCourse = false
  if (examOnly) {
    const { data: failedAttempt } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('course_id', courseIdNum)
      .eq('session_type', 'exam_only')
      .eq('status', 'submitted')
      .eq('passed', false)
      .limit(1)
      .maybeSingle()
    mustTakeCourse = !!failedAttempt
  }

  // Regular students: cooldown from last failed attempt
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
  const { data: recentFailed } = examOnly
    ? { data: null }
    : await supabase
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

  // Best (passing) session
  const { data: bestSession } = await supabase
    .from('exam_sessions')
    .select('id, score, passed, submitted_at, session_type, question_sequence')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .eq('status', 'submitted')
    .eq('passed', true)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle()

  // In-progress session
  const { data: activeSession } = await supabase
    .from('exam_sessions')
    .select('id, questions_answered, question_sequence, answers, session_type, expires_at')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let currentPage: ExamQuestionPage | null = null
  let liveSession = activeSession

  if (activeSession) {
    // Auto-finalize a session found past its 100-minute window
    if (isExpired(activeSession.expires_at)) {
      await gradeAndFinalize(
        adminSupabase,
        activeSession.id,
        activeSession.question_sequence,
        activeSession.answers as Record<string, string>,
        activeSession.questions_answered as number
      )
      if (examOnly) mustTakeCourse = true
      liveSession = null
    } else if (activeSession.question_sequence.length > 0) {
      currentPage = await fetchQuestionPage(
        adminSupabase,
        activeSession.question_sequence,
        activeSession.questions_answered as number,
        activeSession.expires_at
      )
    }
  }

  const nextAllowedAt = recentFailed
    ? new Date(new Date(recentFailed.submitted_at).getTime() + COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
    : null

  return NextResponse.json({
    enrolled:        !!enrollment?.is_active,
    exam_only:       examOnly,
    passed:          !!bestSession,
    bestSession:     bestSession ? {
      id:           bestSession.id,
      score:        bestSession.score,
      total:        bestSession.question_sequence?.length ?? null,
      submitted_at: bestSession.submitted_at,
    } : null,
    inProgress:      !!liveSession,
    activeSession:   liveSession ? {
      id:                 liveSession.id,
      questions_answered: liveSession.questions_answered,
      total_questions:    liveSession.question_sequence.length,
      expires_at:         liveSession.expires_at,
    } : null,
    currentPage,
    cooldown:        !!recentFailed,
    nextAllowedAt,
    mustTakeCourse,
    questionCount:   Math.min(bankCount ?? 0, EXAM_ONLY_QUESTION_TARGET),
  })
}
