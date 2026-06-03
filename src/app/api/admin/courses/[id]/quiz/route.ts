import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, CreateQuizQuestionSchema } from '@/lib/validation'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('course_id', Number(id))
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const parsed = await parseBody(req, CreateQuizQuestionSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const { id } = await params
  const supabase = await createAdminClient()

  if (!body.order_index) {
    const { count } = await supabase
      .from('quiz_questions')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', Number(id))
    body.order_index = (count ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('quiz_questions')
    .insert({
      course_id:      Number(id),
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
      order_index:    Number(body.order_index),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
