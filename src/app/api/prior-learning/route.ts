import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const DeclareSchema = z.object({
  categoryKey:   z.string().min(1),
  bookName:      z.string().min(1),
  teacherName:   z.string().min(1),
  teacherMobile: z.string().min(7).max(15),
})

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const categoryKey = searchParams.get('category')

    // No category → return all declarations (used by exams listing page)
    if (!categoryKey) {
      const { data } = await supabase
        .from('prior_learning_declarations')
        .select('id, category_key, book_name, teacher_name, teacher_mobile, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      return NextResponse.json({ declarations: data ?? [] })
    }

    const { data } = await supabase
      .from('prior_learning_declarations')
      .select('id, book_name, teacher_name, teacher_mobile, created_at')
      .eq('user_id', user.id)
      .eq('category_key', categoryKey)
      .maybeSingle()

    return NextResponse.json({ declaration: data })
  } catch (err) {
    logger.error({ error: String(err) }, 'prior_learning.get.failed')
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const result = DeclareSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    const { categoryKey, bookName, teacherName, teacherMobile } = result.data

    const { error } = await supabase
      .from('prior_learning_declarations')
      .upsert(
        { user_id: user.id, category_key: categoryKey, book_name: bookName, teacher_name: teacherName, teacher_mobile: teacherMobile },
        { onConflict: 'user_id,category_key' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logger.info({ userId: user.id, categoryKey }, 'prior_learning.declared')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ error: String(err) }, 'prior_learning.post.failed')
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
