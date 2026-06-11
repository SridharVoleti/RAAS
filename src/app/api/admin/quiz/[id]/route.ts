import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, UpdateQuizQuestionSchema } from '@/lib/validation'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const parsed = await parseBody(req, UpdateQuizQuestionSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const { id } = await params
  const supabase = await createAdminClient()

  const update: Record<string, unknown> = {
    question_en:    body.question_en,
    question_te:    body.question_te ?? null,
    option_a_en:    body.option_a_en,
    option_a_te:    body.option_a_te ?? null,
    option_b_en:    body.option_b_en,
    option_b_te:    body.option_b_te ?? null,
    option_c_en:    body.option_c_en,
    option_c_te:    body.option_c_te ?? null,
    option_d_en:    body.option_d_en,
    option_d_te:    body.option_d_te ?? null,
    correct_option: body.correct_option,
    order_index:    body.order_index,
  }
  // Move the question to a different lesson when requested
  if (body.lesson_id !== undefined) update.lesson_id = body.lesson_id

  const { data, error } = await supabase
    .from('quiz_questions')
    .update(update)
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const supabase = await createAdminClient()

  const { error } = await supabase.from('quiz_questions').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
