import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const UpdateSchema = z.object({
  difficulty:     z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  question_en:    z.string().min(2).max(2000).optional(),
  question_te:    z.string().max(2000).optional(),
  option_a_en:    z.string().min(1).max(500).optional(),
  option_a_te:    z.string().max(500).optional(),
  option_b_en:    z.string().min(1).max(500).optional(),
  option_b_te:    z.string().max(500).optional(),
  option_c_en:    z.string().min(1).max(500).optional(),
  option_c_te:    z.string().max(500).optional(),
  option_d_en:    z.string().min(1).max(500).optional(),
  option_d_te:    z.string().max(500).optional(),
  correct_option: z.enum(['a', 'b', 'c', 'd']).optional(),
  is_active:      z.boolean().optional(),
})

async function assertAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single()
  return !!data?.is_admin
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await assertAdmin(supabase, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const adminSupa = await createAdminClient()
    const { data, error } = await adminSupa
      .from('prior_learning_exam_questions')
      .update(parsed.data)
      .eq('id', Number(id))
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ question: data })
  } catch (err) {
    logger.error({ error: String(err) }, 'pl_exam_q.patch.failed')
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await assertAdmin(supabase, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminSupa = await createAdminClient()
    const { error } = await adminSupa
      .from('prior_learning_exam_questions')
      .delete()
      .eq('id', Number(id))

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    logger.error({ error: String(err) }, 'pl_exam_q.delete.failed')
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
