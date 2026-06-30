import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const EXAM_LENGTH  = 30
const EXAM_MINUTES = 60

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ categoryKey: string }> }
) {
  try {
    const { categoryKey } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Must have a prior learning declaration
    const { data: declaration } = await supabase
      .from('prior_learning_declarations')
      .select('id')
      .eq('user_id', user.id)
      .eq('category_key', categoryKey)
      .maybeSingle()

    if (!declaration) {
      return NextResponse.json({ error: 'No prior learning declaration for this category' }, { status: 403 })
    }

    const adminSupa = await createAdminClient()

    // Abandon any stale in-progress session
    await adminSupa
      .from('prior_learning_exam_sessions')
      .update({ status: 'expired', submitted_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('category_key', categoryKey)
      .eq('status', 'in_progress')

    // Load all active questions for this category
    const { data: allQuestions } = await adminSupa
      .from('prior_learning_exam_questions')
      .select('id')
      .eq('category_key', categoryKey)
      .eq('is_active', true)

    if (!allQuestions || allQuestions.length === 0) {
      return NextResponse.json({ error: 'No questions available for this exam yet' }, { status: 503 })
    }

    // Shuffle and pick up to EXAM_LENGTH questions
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(EXAM_LENGTH, shuffled.length))
    const questionIds = selected.map(q => q.id)

    const now = new Date()
    const expiresAt = new Date(now.getTime() + EXAM_MINUTES * 60 * 1000)

    const { data: session, error: sessionErr } = await supabase
      .from('prior_learning_exam_sessions')
      .insert({
        user_id:      user.id,
        category_key: categoryKey,
        status:       'in_progress',
        question_ids: questionIds,
        answers:      {},
        expires_at:   expiresAt.toISOString(),
      })
      .select()
      .single()

    if (sessionErr || !session) {
      logger.error({ error: sessionErr?.message, userId: user.id }, 'pl_exam.session.create.failed')
      return NextResponse.json({ error: 'Failed to create exam session' }, { status: 500 })
    }

    // Fetch first question (without correct_option)
    const { data: question } = await adminSupa
      .from('prior_learning_exam_questions')
      .select('id, category_key, difficulty, question_en, question_te, option_a_en, option_a_te, option_b_en, option_b_te, option_c_en, option_c_te, option_d_en, option_d_te')
      .eq('id', questionIds[0])
      .single()

    logger.info({ userId: user.id, categoryKey, sessionId: session.id, totalQ: questionIds.length }, 'pl_exam.started')

    return NextResponse.json({
      session_id:      session.id,
      expires_at:      session.expires_at,
      question,
      question_number: 1,
      total_questions: questionIds.length,
    })
  } catch (err) {
    logger.error({ error: String(err) }, 'pl_exam.start.failed')
    return NextResponse.json({ error: 'Failed to start exam' }, { status: 500 })
  }
}
