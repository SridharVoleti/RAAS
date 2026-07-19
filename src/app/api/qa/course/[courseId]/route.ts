import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canAccessCourseQA, attachAuthors } from '@/lib/qa'
import type { CourseQuestion } from '@/types'

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params
  const courseIdNum = Number(courseId)

  if (!(await canAccessCourseQA(user.id, courseIdNum))) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()

  const { data: questions, error } = await adminSupabase
    .from('course_questions')
    .select('id, course_id, lesson_id, user_id, body, created_at, lessons(title_en, title_te)')
    .eq('course_id', courseIdNum)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const questionIds = (questions ?? []).map(q => q.id)
  const { data: answers } = questionIds.length > 0
    ? await adminSupabase
        .from('course_answers')
        .select('id, question_id, user_id, body, created_at')
        .in('question_id', questionIds)
        .order('created_at', { ascending: true })
    : { data: [] as { id: number; question_id: number; user_id: string; body: string; created_at: string }[] }

  type QuestionRow = {
    id: number; course_id: number; lesson_id: number; user_id: string; body: string; created_at: string
    lessons: { title_en: string; title_te: string | null } | { title_en: string; title_te: string | null }[] | null
  }
  const flattenedQuestions = (questions ?? []).map((q) => {
    const row = q as QuestionRow
    const lesson = Array.isArray(row.lessons) ? row.lessons[0] : row.lessons
    return {
      id: row.id, course_id: row.course_id, lesson_id: row.lesson_id, user_id: row.user_id,
      body: row.body, created_at: row.created_at,
      lesson_title_en: lesson?.title_en, lesson_title_te: lesson?.title_te ?? undefined,
    }
  })

  const [questionsWithAuthors, answersWithAuthors] = await Promise.all([
    attachAuthors(adminSupabase, user.id, flattenedQuestions),
    attachAuthors(adminSupabase, user.id, answers ?? []),
  ])

  const result: CourseQuestion[] = questionsWithAuthors.map(q => ({
    ...q,
    answers: answersWithAuthors.filter(a => a.question_id === q.id),
  }))

  return NextResponse.json({ questions: result })
}
