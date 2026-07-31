import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const ImportRowSchema = z.object({
  course_id:    z.number().int().positive(),
  chapter_id:   z.number().int().positive().optional(),
  chapter_name: z.string().max(200).optional(),
  question_te:  z.string().max(2000).default(''),
  option_a_te:  z.string().min(1).max(500),
  option_b_te:  z.string().min(1).max(500),
  option_c_te:  z.string().min(1).max(500),
  option_d_te:  z.string().min(1).max(500),
  correct_option: z.enum(['a', 'b', 'c', 'd']),
})

const ImportBodySchema = z.object({
  rows: z.array(ImportRowSchema).min(1).max(500),
})

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ImportBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const supabase = await createAdminClient()

  const rows = parsed.data.rows.map(r => ({
    course_id:     r.course_id,
    chapter_id:    r.chapter_id ?? null,
    chapter_name:  r.chapter_name?.trim() || null,
    question_te:   r.question_te || '',
    option_a_te:   r.option_a_te,
    option_b_te:   r.option_b_te,
    option_c_te:   r.option_c_te,
    option_d_te:   r.option_d_te,
    correct_option: r.correct_option,
  }))

  const { data, error } = await supabase.from('exam_questions').insert(rows).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imported: data?.length ?? 0 }, { status: 201 })
}
