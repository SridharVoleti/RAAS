import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, ExamAnswerSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'
import type { ExamNextQuestion, ExamComplete, ExamQuestion_Public } from '@/types'

const PASS_THRESHOLD = 0.70

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, ExamAnswerSchema)
  if (!parsed.success) return parsed.response
  const { session_id, question_id, answer } = parsed.data

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
  const examLength = seq.length
  const currentIdx = session.questions_answered as number

  // Validate the question being answered is the current one in the sequence
  if (seq[currentIdx] !== question_id) {
    return NextResponse.json({ error: 'Unexpected question_id' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Fetch correct answer server-side
  const { data: qRow } = await adminSupabase
    .from('exam_questions')
    .select('correct_option')
    .eq('id', question_id)
    .single()

  if (!qRow) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  const isCorrect = answer === qRow.correct_option
  const newAnswers = { ...(session.answers as Record<string, string>), [String(question_id)]: answer }
  const newAnswered = currentIdx + 1

  // Exam complete
  if (newAnswered >= examLength) {
    const { data: allQuestions } = await adminSupabase
      .from('exam_questions')
      .select('id, correct_option')
      .in('id', seq)

    let score = 0
    if (allQuestions) {
      for (const q of allQuestions) {
        if (newAnswers[String(q.id)] === q.correct_option) score++
      }
    }

    const passed = score / examLength >= PASS_THRESHOLD
    const now = new Date().toISOString()

    await adminSupabase
      .from('exam_sessions')
      .update({
        answers:            newAnswers,
        questions_answered: newAnswered,
        status:             'submitted',
        score,
        passed,
        submitted_at:       now,
      })
      .eq('id', session_id)

    logger.info({ userId: user.id, courseId: courseIdNum, sessionId: session_id, score, total: examLength, passed }, 'exam.session.submitted')

    const result: ExamComplete = { done: true, score, total: examLength, passed, session_id }
    return NextResponse.json(result)
  }

  // Fetch the next question from the pre-built sequence
  const nextQId = seq[newAnswered]
  const { data: nextQ } = await adminSupabase
    .from('exam_questions')
    .select('*')
    .eq('id', nextQId)
    .single()

  if (!nextQ) {
    return NextResponse.json({ error: 'Next question not found in bank' }, { status: 500 })
  }

  await adminSupabase
    .from('exam_sessions')
    .update({
      answers:            newAnswers,
      questions_answered: newAnswered,
    })
    .eq('id', session_id)

  const { correct_option: _omit, ...publicQuestion } = nextQ
  const response: ExamNextQuestion = {
    question:        publicQuestion as ExamQuestion_Public,
    question_number: newAnswered + 1,
    total_questions: examLength,
    done:            false,
  }

  // Note: isCorrect is available here if we ever want to add per-answer feedback
  void isCorrect

  return NextResponse.json(response)
}
