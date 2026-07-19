import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, ExamPageAnswerSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { EXAM_ONLY_MAX_ATTEMPTS, countExamOnlyFailedAttempts, fetchQuestionPage, gradeAndFinalize, isExpired } from '@/lib/exam'
import type { ExamComplete } from '@/types'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, ExamPageAnswerSchema)
  if (!parsed.success) return parsed.response
  const { session_id, answers: pageAnswers } = parsed.data

  const { courseId } = await params
  const courseIdNum = Number(courseId)

  // Load session (RLS ensures it belongs to this user)
  const { data: session } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('id', session_id)
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .eq('status', 'in_progress')
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Session not found or already submitted' }, { status: 404 })
  }

  const seq: number[] = session.question_sequence
  const currentIdx = session.questions_answered as number
  const adminSupabase = await createAdminClient()
  const isExamOnly = session.session_type === 'exam_only'

  // Time is up: grade whatever was answered before this page (unanswered = wrong)
  if (isExpired(session.expires_at)) {
    const finalAnswers = session.answers as Record<string, string>
    const { score, total, passed } = await gradeAndFinalize(
      adminSupabase, session_id, seq, finalAnswers, currentIdx
    )
    logger.info({ userId: user.id, courseId: courseIdNum, sessionId: session_id, score, total, passed }, 'exam.session.expired')
    const mustTakeCourse = isExamOnly && !passed &&
      (await countExamOnlyFailedAttempts(supabase, user.id, courseIdNum)) >= EXAM_ONLY_MAX_ATTEMPTS
    const result: ExamComplete = {
      done: true, score, total, passed, session_id,
      expired: true,
      ...(isExamOnly ? { exam_only: true } : {}),
      ...(mustTakeCourse ? { must_take_course: true } : {}),
    }
    return NextResponse.json(result)
  }

  // The submitted page must be exactly the next unanswered slice of the sequence
  const expectedIds = seq.slice(currentIdx, currentIdx + pageAnswers.length)
  const submittedIds = pageAnswers.map(a => a.question_id)
  const matchesSlice =
    expectedIds.length === submittedIds.length &&
    expectedIds.every((id, i) => id === submittedIds[i])

  if (!matchesSlice) {
    return NextResponse.json({ error: 'Submitted questions do not match the current page' }, { status: 400 })
  }

  const newAnswers = { ...(session.answers as Record<string, string>) }
  for (const a of pageAnswers) newAnswers[String(a.question_id)] = a.answer
  const newAnswered = currentIdx + pageAnswers.length

  // Exam complete
  if (newAnswered >= seq.length) {
    const { score, total, passed } = await gradeAndFinalize(
      adminSupabase, session_id, seq, newAnswers, newAnswered
    )
    logger.info({ userId: user.id, courseId: courseIdNum, sessionId: session_id, score, total, passed }, 'exam.session.submitted')
    const mustTakeCourse = isExamOnly && !passed &&
      (await countExamOnlyFailedAttempts(supabase, user.id, courseIdNum)) >= EXAM_ONLY_MAX_ATTEMPTS
    const result: ExamComplete = {
      done: true, score, total, passed, session_id,
      ...(isExamOnly ? { exam_only: true } : {}),
      ...(mustTakeCourse ? { must_take_course: true } : {}),
    }
    return NextResponse.json(result)
  }

  // Persist progress and return the next page
  await adminSupabase
    .from('exam_sessions')
    .update({
      answers:            newAnswers,
      questions_answered: newAnswered,
    })
    .eq('id', session_id)

  const nextPage = await fetchQuestionPage(adminSupabase, seq, newAnswered, session.expires_at)
  if (!nextPage) {
    return NextResponse.json({ error: 'Next questions not found in bank' }, { status: 500 })
  }

  return NextResponse.json(nextPage)
}
