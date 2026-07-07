import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExamQuestionPage, ExamQuestion_Public } from '@/types'

export const EXAM_PAGE_SIZE = 10
export const PASS_THRESHOLD = 0.60
export const EXAM_ONLY_QUESTION_TARGET = 100
export const EXAM_ONLY_DURATION_MINUTES = 100
export const COOLDOWN_HOURS = 48

/** Fetch one page of questions (correct_option stripped) for a pre-built sequence. */
export async function fetchQuestionPage(
  adminSupabase: SupabaseClient,
  sequence: number[],
  offset: number,
  expiresAt: string | null
): Promise<ExamQuestionPage | null> {
  const pageIds = sequence.slice(offset, offset + EXAM_PAGE_SIZE)
  if (pageIds.length === 0) return null

  const { data: rows } = await adminSupabase
    .from('exam_questions')
    .select('*')
    .in('id', pageIds)

  if (!rows || rows.length !== pageIds.length) return null

  const byId = new Map(rows.map(r => [r.id as number, r]))
  const questions: ExamQuestion_Public[] = pageIds.map(id => {
    const { correct_option: _omit, ...publicQuestion } = byId.get(id)!
    return publicQuestion as ExamQuestion_Public
  })

  return {
    questions,
    page_number:     Math.floor(offset / EXAM_PAGE_SIZE) + 1,
    total_pages:     Math.ceil(sequence.length / EXAM_PAGE_SIZE),
    question_offset: offset,
    total_questions: sequence.length,
    expires_at:      expiresAt,
    done:            false,
  }
}

/**
 * Grade a session against its full sequence (unanswered questions count as wrong)
 * and mark it submitted. Returns the outcome.
 */
export async function gradeAndFinalize(
  adminSupabase: SupabaseClient,
  sessionId: string,
  sequence: number[],
  answers: Record<string, string>,
  questionsAnswered: number
): Promise<{ score: number; total: number; passed: boolean }> {
  const { data: allQuestions } = await adminSupabase
    .from('exam_questions')
    .select('id, correct_option')
    .in('id', sequence)

  let score = 0
  if (allQuestions) {
    for (const q of allQuestions) {
      if (answers[String(q.id)] === q.correct_option) score++
    }
  }

  const total = sequence.length
  const passed = score / total >= PASS_THRESHOLD

  await adminSupabase
    .from('exam_sessions')
    .update({
      answers,
      questions_answered: questionsAnswered,
      status:             'submitted',
      score,
      passed,
      submitted_at:       new Date().toISOString(),
    })
    .eq('id', sessionId)

  return { score, total, passed }
}

/** True when an exam-only session has run past its 100-minute window. */
export function isExpired(expiresAt: string | null): boolean {
  return !!expiresAt && new Date(expiresAt).getTime() < Date.now()
}
