import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, QuizSubmitSchema } from '@/lib/validation'
import type { QuizResult } from '@/types'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, QuizSubmitSchema)
  if (!parsed.success) return parsed.response
  const { answers } = parsed.data

  const { chapterId } = await params
  const chapterIdNum = Number(chapterId)

  const adminSupabase = await createAdminClient()

  // Resolve chapter → course for enrollment check
  const { data: chapter } = await adminSupabase
    .from('chapters')
    .select('course_id')
    .eq('id', chapterIdNum)
    .single()

  if (!chapter) return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('is_active')
    .eq('user_id', user.id)
    .eq('course_id', chapter.course_id)
    .maybeSingle()

  if (!enrollment?.is_active) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
  }

  // Fetch correct answers for the submitted question IDs only
  const questionIds = Object.keys(answers).map(Number)
  const { data: questions, error } = await adminSupabase
    .from('quiz_questions')
    .select('id, correct_option')
    .eq('chapter_id', chapterIdNum)
    .in('id', questionIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'No matching questions found' }, { status: 404 })
  }

  // Grade
  let score = 0
  const results: QuizResult['results'] = {}
  for (const q of questions) {
    const isCorrect = answers[String(q.id)] === q.correct_option
    if (isCorrect) score++
    results[q.id] = { correct: isCorrect, correct_option: q.correct_option as 'a' | 'b' | 'c' | 'd' }
  }

  await supabase.from('quiz_submissions').insert({
    user_id:         user.id,
    chapter_id:      chapterIdNum,
    score,
    total_questions: questions.length,
  })

  return NextResponse.json({ score, total: questions.length, results } satisfies QuizResult)
}
