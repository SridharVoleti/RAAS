import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const PASS_THRESHOLD = 0.70

// Force-submit called when the client-side timer reaches zero
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ categoryKey: string }> }
) {
  try {
    const { categoryKey } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: session } = await supabase
      .from('prior_learning_exam_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('category_key', categoryKey)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!session) return NextResponse.json({ error: 'No active session' }, { status: 404 })

    const adminSupa = await createAdminClient()
    const questionIds = session.question_ids as number[]
    const answers     = session.answers as Record<string, string>

    const { data: qs } = await adminSupa
      .from('prior_learning_exam_questions')
      .select('id, correct_option')
      .in('id', questionIds)

    const score  = (qs ?? []).reduce((acc, q) => acc + (answers[String(q.id)] === q.correct_option ? 1 : 0), 0)
    const total  = questionIds.length
    const passed = total > 0 && score / total >= PASS_THRESHOLD
    const now    = new Date().toISOString()

    await adminSupa
      .from('prior_learning_exam_sessions')
      .update({ answers, score, total, passed, status: 'expired', submitted_at: now })
      .eq('id', session.id)

    logger.info({ userId: user.id, categoryKey, sessionId: session.id, score, passed }, 'pl_exam.force_submitted')
    return NextResponse.json({ done: true, score, total, passed, session_id: session.id, expired: true })
  } catch (err) {
    logger.error({ error: String(err) }, 'pl_exam.submit.failed')
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
  }
}
