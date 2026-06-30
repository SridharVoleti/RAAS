import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const PASS_THRESHOLD = 0.70

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ categoryKey: string }> }
) {
  try {
    const { categoryKey } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: declaration } = await supabase
      .from('prior_learning_declarations')
      .select('id, book_name')
      .eq('user_id', user.id)
      .eq('category_key', categoryKey)
      .maybeSingle()

    if (!declaration) {
      return NextResponse.json({ error: 'No prior learning declaration for this category' }, { status: 403 })
    }

    const { data: session } = await supabase
      .from('prior_learning_exam_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_key', categoryKey)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) return NextResponse.json({ status: 'none', declaration })

    const now = new Date()
    const answers = session.answers as Record<string, string>
    const questionIds = session.question_ids as number[]

    // Server-side expiry check
    if (session.status === 'in_progress' && now > new Date(session.expires_at)) {
      const adminSupa = await createAdminClient()
      const { data: qs } = await adminSupa
        .from('prior_learning_exam_questions')
        .select('id, correct_option')
        .in('id', questionIds)
      const score = (qs ?? []).reduce((acc, q) => acc + (answers[String(q.id)] === q.correct_option ? 1 : 0), 0)
      const total = questionIds.length
      const passed = total > 0 && score / total >= PASS_THRESHOLD
      await adminSupa
        .from('prior_learning_exam_sessions')
        .update({ status: 'expired', score, total, passed, submitted_at: now.toISOString() })
        .eq('id', session.id)
      logger.info({ userId: user.id, categoryKey, score, passed }, 'pl_exam.expired')
      return NextResponse.json({ status: 'expired', score, total, passed, session_id: session.id, declaration })
    }

    if (session.status === 'in_progress') {
      const answered = Object.keys(answers).length
      const adminSupa = await createAdminClient()
      const { data: question } = await adminSupa
        .from('prior_learning_exam_questions')
        .select('id, category_key, difficulty, question_en, question_te, option_a_en, option_a_te, option_b_en, option_b_te, option_c_en, option_c_te, option_d_en, option_d_te')
        .eq('id', questionIds[answered])
        .single()

      return NextResponse.json({
        status:          'in_progress',
        session_id:      session.id,
        expires_at:      session.expires_at,
        question,
        question_number: answered + 1,
        total_questions: questionIds.length,
        declaration,
      })
    }

    return NextResponse.json({
      status:       session.status,
      score:        session.score,
      total:        session.total,
      passed:       session.passed,
      session_id:   session.id,
      submitted_at: session.submitted_at,
      declaration,
    })
  } catch (err) {
    logger.error({ error: String(err) }, 'pl_exam.session.get.failed')
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 })
  }
}
