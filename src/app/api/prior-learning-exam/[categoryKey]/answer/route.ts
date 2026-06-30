import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const PASS_THRESHOLD = 0.70

const AnswerSchema = z.object({
  session_id:  z.string().uuid(),
  question_id: z.number().int().positive(),
  answer:      z.enum(['a', 'b', 'c', 'd']),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ categoryKey: string }> }
) {
  try {
    const { categoryKey } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const parsed = AnswerSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
    const { session_id, question_id, answer } = parsed.data

    // Load session (RLS ensures it belongs to this user)
    const { data: session } = await supabase
      .from('prior_learning_exam_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .eq('category_key', categoryKey)
      .eq('status', 'in_progress')
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found or already submitted' }, { status: 404 })

    const questionIds = session.question_ids as number[]
    const answers     = session.answers as Record<string, string>
    const answered    = Object.keys(answers).length

    // Guard: question_id must be the current expected question
    if (questionIds[answered] !== question_id) {
      return NextResponse.json({ error: 'Unexpected question_id' }, { status: 400 })
    }

    const adminSupa = await createAdminClient()

    // Check timer — force-submit if expired
    const now = new Date()
    const expired = now > new Date(session.expires_at)

    const newAnswers = { ...answers, [String(question_id)]: answer }
    const newAnswered = answered + 1
    const isDone = newAnswered >= questionIds.length || expired

    if (isDone) {
      const { data: qs } = await adminSupa
        .from('prior_learning_exam_questions')
        .select('id, correct_option')
        .in('id', questionIds)
      const score = (qs ?? []).reduce((acc, q) => acc + (newAnswers[String(q.id)] === q.correct_option ? 1 : 0), 0)
      const total = questionIds.length
      const passed = score / total >= PASS_THRESHOLD
      const status = expired ? 'expired' : 'submitted'

      await adminSupa
        .from('prior_learning_exam_sessions')
        .update({ answers: newAnswers, score, total, passed, status, submitted_at: now.toISOString() })
        .eq('id', session_id)

      logger.info({ userId: user.id, categoryKey, sessionId: session_id, score, passed, expired }, 'pl_exam.submitted')
      return NextResponse.json({ done: true, score, total, passed, session_id, expired })
    }

    // Not done — persist answer and return next question
    await adminSupa
      .from('prior_learning_exam_sessions')
      .update({ answers: newAnswers })
      .eq('id', session_id)

    const { data: nextQuestion } = await adminSupa
      .from('prior_learning_exam_questions')
      .select('id, category_key, difficulty, question_en, question_te, option_a_en, option_a_te, option_b_en, option_b_te, option_c_en, option_c_te, option_d_en, option_d_te')
      .eq('id', questionIds[newAnswered])
      .single()

    return NextResponse.json({
      done:            false,
      question:        nextQuestion,
      question_number: newAnswered + 1,
      total_questions: questionIds.length,
    })
  } catch (err) {
    logger.error({ error: String(err) }, 'pl_exam.answer.failed')
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 })
  }
}
