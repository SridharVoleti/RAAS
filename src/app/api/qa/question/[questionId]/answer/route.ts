import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, CreateAnswerSchema } from '@/lib/validation'
import { canAccessCourseQA, attachAuthors } from '@/lib/qa'
import type { CourseAnswer } from '@/types'

export async function POST(req: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, CreateAnswerSchema)
  if (!parsed.success) return parsed.response

  const { questionId } = await params
  const questionIdNum = Number(questionId)
  const adminSupabase = createAdminClient()

  const { data: question } = await adminSupabase
    .from('course_questions')
    .select('course_id')
    .eq('id', questionIdNum)
    .single()

  if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 })

  if (!(await canAccessCourseQA(user.id, question.course_id))) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
  }

  const { data: answer, error } = await adminSupabase
    .from('course_answers')
    .insert({ question_id: questionIdNum, user_id: user.id, body: parsed.data.body })
    .select('id, question_id, user_id, body, created_at')
    .single()

  if (error || !answer) {
    return NextResponse.json({ error: error?.message || 'Failed to post answer' }, { status: 500 })
  }

  const [withAuthor] = await attachAuthors(adminSupabase, user.id, [answer])
  return NextResponse.json({ answer: withAuthor satisfies CourseAnswer })
}
