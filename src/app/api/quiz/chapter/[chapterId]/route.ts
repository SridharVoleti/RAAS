import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { QuizQuestion_Public } from '@/types'

const QUIZ_QUESTIONS_PER_ATTEMPT = 5

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ chapterId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // Pick N random questions from the exam bank for this chapter
  const { data: questions, error } = await adminSupabase
    .from('exam_questions')
    .select('id, chapter_id, question_te, option_a_te, option_b_te, option_c_te, option_d_te')
    .eq('chapter_id', chapterIdNum)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!questions || questions.length === 0) {
    return NextResponse.json({ error: 'No questions found for this chapter' }, { status: 404 })
  }

  // Fisher-Yates shuffle then take first N
  const shuffled = [...questions]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const selected = shuffled.slice(0, QUIZ_QUESTIONS_PER_ATTEMPT).map(q => ({
    ...q,
    order_index: 0,
  })) as QuizQuestion_Public[]

  return NextResponse.json({ questions: selected, total_in_pool: questions.length })
}
