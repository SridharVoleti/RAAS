import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const QuestionSchema = z.object({
  category_key:   z.string().min(1),
  difficulty:     z.union([z.literal(1), z.literal(2), z.literal(3)]),
  question_en:    z.string().min(2).max(2000),
  question_te:    z.string().max(2000).optional(),
  option_a_en:    z.string().min(1).max(500),
  option_a_te:    z.string().max(500).optional(),
  option_b_en:    z.string().min(1).max(500),
  option_b_te:    z.string().max(500).optional(),
  option_c_en:    z.string().min(1).max(500),
  option_c_te:    z.string().max(500).optional(),
  option_d_en:    z.string().min(1).max(500),
  option_d_te:    z.string().max(500).optional(),
  correct_option: z.enum(['a', 'b', 'c', 'd']),
  is_active:      z.boolean().default(true),
})

async function assertAdmin(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', userId).single()
  return !!data?.is_admin
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await assertAdmin(supabase, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const categoryKey = searchParams.get('category')

    const adminSupa = await createAdminClient()
    let query = adminSupa.from('prior_learning_exam_questions').select('*').order('created_at', { ascending: false })
    if (categoryKey) query = query.eq('category_key', categoryKey)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ questions: data })
  } catch (err) {
    logger.error({ error: String(err) }, 'pl_exam_q.get.failed')
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !(await assertAdmin(supabase, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: unknown
    try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
    const parsed = QuestionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const adminSupa = await createAdminClient()
    const { data, error } = await adminSupa
      .from('prior_learning_exam_questions')
      .insert(parsed.data)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    logger.info({ userId: user.id, questionId: data.id }, 'pl_exam_q.created')
    return NextResponse.json({ question: data }, { status: 201 })
  } catch (err) {
    logger.error({ error: String(err) }, 'pl_exam_q.post.failed')
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }
}
