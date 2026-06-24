import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, ExamAnswerSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'
import type { ExamNextQuestion, ExamComplete, ExamQuestion_Public } from '@/types'

const EXAM_LENGTH = 60
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

  // Ensure question_id is the last in the sequence (prevents replay / skipping)
  const seq: number[] = session.question_sequence
  if (seq[seq.length - 1] !== question_id) {
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
  const newAnswered = session.questions_answered + 1

  // Adaptive difficulty adjustment
  let nextDifficulty: number = session.current_difficulty
  if (isCorrect) nextDifficulty = Math.min(3, session.current_difficulty + 1)
  else           nextDifficulty = Math.max(1, session.current_difficulty - 1)

  // Check if exam is complete
  if (newAnswered >= EXAM_LENGTH) {
    // Score all answers
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

    const passed = score / EXAM_LENGTH >= PASS_THRESHOLD
    const now = new Date().toISOString()

    await adminSupabase
      .from('exam_sessions')
      .update({
        answers:            newAnswers,
        questions_answered: newAnswered,
        current_difficulty: nextDifficulty,
        status:             'submitted',
        score,
        passed,
        submitted_at:       now,
      })
      .eq('id', session_id)

    logger.info({ userId: user.id, courseId: courseIdNum, sessionId: session_id, score, passed }, 'exam.session.submitted')

    const result: ExamComplete = { done: true, score, total: EXAM_LENGTH, passed, session_id }
    return NextResponse.json(result)
  }

  // Pick next question at updated difficulty, excluding already-used IDs
  const nextQ = await pickQuestion(adminSupabase, courseIdNum, nextDifficulty, seq)
  if (!nextQ) {
    return NextResponse.json({ error: 'No more questions available in the bank' }, { status: 503 })
  }

  const newSeq = [...seq, nextQ.id]

  await adminSupabase
    .from('exam_sessions')
    .update({
      answers:            newAnswers,
      question_sequence:  newSeq,
      questions_answered: newAnswered,
      current_difficulty: nextDifficulty,
    })
    .eq('id', session_id)

  const { correct_option: _omit, ...publicQuestion } = nextQ
  const response: ExamNextQuestion = {
    question:        publicQuestion as ExamQuestion_Public,
    question_number: newAnswered + 1,
    total_questions: EXAM_LENGTH,
    done:            false,
  }
  return NextResponse.json(response)
}

async function pickQuestion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  courseId: number,
  difficulty: number,
  usedIds: number[]
) {
  for (const diff of getCandidateDifficulties(difficulty)) {
    let query = supabase
      .from('exam_questions')
      .select('*')
      .eq('course_id', courseId)
      .eq('difficulty', diff)
      .not('id', 'in', `(${usedIds.join(',')})`)

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
