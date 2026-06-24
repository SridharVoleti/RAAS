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

  const difficulty = searchParams.get('difficulty')
  const supabase = await createAdminClient()

  let query = supabase
    .from('exam_questions')
    .select('*')
    .eq('course_id', courseId)
    .order('difficulty', { ascending: true })
    .order('id', { ascending: true })

  if (difficulty && ['1', '2', '3'].includes(difficulty)) {
    query = query.eq('difficulty', Number(difficulty))
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
      course_id:      body.course_id,
      difficulty:     body.difficulty,
      question_en:    body.question_en,
      question_te:    body.question_te || null,
      option_a_en:    body.option_a_en,
      option_a_te:    body.option_a_te || null,
      option_b_en:    body.option_b_en,
      option_b_te:    body.option_b_te || null,
      option_c_en:    body.option_c_en,
      option_c_te:    body.option_c_te || null,
      option_d_en:    body.option_d_en,
      option_d_te:    body.option_d_te || null,
      correct_option: body.correct_option,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
