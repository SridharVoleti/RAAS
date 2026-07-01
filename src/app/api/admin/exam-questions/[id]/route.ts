import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, UpdateExamQuestionSchema } from '@/lib/validation'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const parsed = await parseBody(req, UpdateExamQuestionSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const { id } = await params
  const supabase = await createAdminClient()

  const update: Record<string, unknown> = {}
  if (body.chapter_name   !== undefined) update.chapter_name   = body.chapter_name?.trim() || null
  if (body.difficulty     !== undefined) update.difficulty     = body.difficulty
  if (body.question_en    !== undefined) update.question_en    = body.question_en
  if (body.question_te    !== undefined) update.question_te    = body.question_te || null
  if (body.option_a_en    !== undefined) update.option_a_en    = body.option_a_en
  if (body.option_a_te    !== undefined) update.option_a_te    = body.option_a_te || null
  if (body.option_b_en    !== undefined) update.option_b_en    = body.option_b_en
  if (body.option_b_te    !== undefined) update.option_b_te    = body.option_b_te || null
  if (body.option_c_en    !== undefined) update.option_c_en    = body.option_c_en
  if (body.option_c_te    !== undefined) update.option_c_te    = body.option_c_te || null
  if (body.option_d_en    !== undefined) update.option_d_en    = body.option_d_en
  if (body.option_d_te    !== undefined) update.option_d_te    = body.option_d_te || null
  if (body.correct_option !== undefined) update.correct_option = body.correct_option

  const { data, error } = await supabase
    .from('exam_questions')
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

  const { error } = await supabase
    .from('exam_questions')
    .delete()
    .eq('id', Number(id))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
