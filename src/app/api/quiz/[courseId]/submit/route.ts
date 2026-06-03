import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, QuizSubmitSchema } from '@/lib/validation'
import type { QuizResult } from '@/types'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, QuizSubmitSchema)
  if (!parsed.success) return parsed.response
  const { answers } = parsed.data

  const { courseId } = await params
  const courseIdNum = Number(courseId)

  // Verify active enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('is_active')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .maybeSingle()

  if (!enrollment?.is_active) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
  }

  // Fetch correct answers (admin client has access to correct_option)
  const adminSupabase = await createAdminClient()
  const { data: questions, error } = await adminSupabase
    .from('quiz_questions')
    .select('id, correct_option')
    .eq('course_id', courseIdNum)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'No questions found' }, { status: 404 })
  }

  // Compute score
  let score = 0
  const results: QuizResult['results'] = {}
  for (const q of questions) {
    const userAnswer = answers[String(q.id)]
    const isCorrect = userAnswer === q.correct_option
    if (isCorrect) score++
    results[q.id] = { correct: isCorrect, correct_option: q.correct_option as 'a' | 'b' | 'c' | 'd' }
  }

  // Store submission (allow retakes — insert new row each time)
  await supabase.from('quiz_submissions').insert({
    user_id:         user.id,
    course_id:       courseIdNum,
    score,
    total_questions: questions.length,
  })

  const result: QuizResult = { score, total: questions.length, results }
  return NextResponse.json(result)
}
