import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ExamQuestion_Public } from '@/types'

const EXAM_LENGTH = 60
const COOLDOWN_HOURS = 48

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params
  const courseIdNum = Number(courseId)

  // Check enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('is_active, exam_only')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .maybeSingle()

  // Check cooldown from last failed attempt
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

  // Best (passing) session
  const { data: bestSession } = await supabase
    .from('exam_sessions')
    .select('id, score, passed, submitted_at, session_type')
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
    .select('id, questions_answered, question_sequence, current_difficulty')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let currentQuestion: (ExamQuestion_Public & { question_number: number }) | null = null

  if (activeSession && activeSession.question_sequence.length > 0) {
    const adminSupabase = await createAdminClient()
    const lastQId = activeSession.question_sequence[activeSession.question_sequence.length - 1]
    const { data: qRow } = await adminSupabase
      .from('exam_questions')
      .select('id, course_id, difficulty, question_en, question_te, option_a_en, option_a_te, option_b_en, option_b_te, option_c_en, option_c_te, option_d_en, option_d_te, created_at')
      .eq('id', lastQId)
      .single()

    if (qRow) {
      currentQuestion = { ...qRow, question_number: activeSession.question_sequence.length }
    }
  }

  const nextAllowedAt = recentFailed
    ? new Date(new Date(recentFailed.submitted_at).getTime() + COOLDOWN_HOURS * 60 * 60 * 1000).toISOString()
    : null

  return NextResponse.json({
    enrolled:        !!enrollment?.is_active,
    exam_only:       enrollment?.exam_only ?? false,
    passed:          !!bestSession,
    bestSession,
    inProgress:      !!activeSession,
    activeSession:   activeSession ? {
      id:                  activeSession.id,
      questions_answered:  activeSession.questions_answered,
      total_questions:     EXAM_LENGTH,
      current_difficulty:  activeSession.current_difficulty,
    } : null,
    currentQuestion,
    cooldown:        !!recentFailed,
    nextAllowedAt,
  })
}
