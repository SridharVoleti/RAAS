import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { logger } from '@/lib/logger'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function encodeCursor(id: number): string {
  return Buffer.from(String(id)).toString('base64url')
}

function decodeCursor(cursor: string): number | null {
  try {
    const val = parseInt(Buffer.from(cursor, 'base64url').toString('utf-8'), 10)
    return isNaN(val) ? null : val
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { searchParams } = new URL(request.url)
  const rawLimit = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
  const limit = Math.min(isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, MAX_LIMIT)
  const cursorParam = searchParams.get('cursor')

  const supabase = await createAdminClient()

  let query = supabase
    .from('payment_logs')
    .select('*')
    .eq('status', 'created')
    .order('id', { ascending: true })
    .limit(limit + 1)

  if (cursorParam) {
    const afterId = decodeCursor(cursorParam)
    if (afterId !== null) {
      query = query.gt('id', afterId)
    }
  }

  const { data: payments, error } = await query

  if (error) {
    logger.error({ error: error.message }, 'admin payments list failed')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!payments || payments.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null })
  }

  const hasMore = payments.length > limit
  const page = hasMore ? payments.slice(0, limit) : payments
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1].id) : null

  const userIds = [...new Set(page.map(p => p.user_id))]
  const courseIds = [...new Set(page.map(p => p.course_id))]

  const [{ data: profiles }, { data: courses }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', userIds),
    supabase.from('courses').select('id, title_en').in('id', courseIds),
  ])

  const result = page.map(p => ({
    ...p,
    student_name: profiles?.find(pr => pr.id === p.user_id)?.full_name ?? '—',
    course_title: courses?.find(c => c.id === p.course_id)?.title_en ?? '—',
  }))

  logger.info({ count: result.length, paginated: !!cursorParam }, 'admin payments listed')
  return NextResponse.json({ items: result, nextCursor })
}
