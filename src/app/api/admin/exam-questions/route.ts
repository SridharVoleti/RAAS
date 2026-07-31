import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, CreateExamQuestionSchema } from '@/lib/validation'

export async function GET(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { searchParams } = new URL(req.url)
  const courseId = Number(searchParams.get('courseId'))
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  const chapterName = searchParams.get('chapterName')
  const supabase = await createAdminClient()

  let query = supabase
    .from('exam_questions')
    .select('*')
    .eq('course_id', courseId)
    .order('chapter_name', { ascending: true, nullsFirst: false })
    .order('id', { ascending: true })

  if (chapterName) {
    query = query.eq('chapter_name', chapterName)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const parsed = await parseBody(req, CreateExamQuestionSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('exam_questions')
    .insert({
      course_id:    body.course_id,
      chapter_id:   body.chapter_id ?? null,
      chapter_name: body.chapter_name?.trim() || null,
      question_te:  body.question_te,
      option_a_te:  body.option_a_te,
      option_b_te:  body.option_b_te,
      option_c_te:  body.option_c_te,
      option_d_te:  body.option_d_te,
      correct_option: body.correct_option,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
