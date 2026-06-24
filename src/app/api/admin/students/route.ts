import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { logger } from '@/lib/logger'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function encodeCursor(value: string): string {
  return Buffer.from(value).toString('base64url')
}

function decodeCursor(cursor: string): string | null {
  try {
    return Buffer.from(cursor, 'base64url').toString('utf-8')
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
    .from('profiles')
    .select('id, full_name, avatar_initials, created_at, is_admin, student_id')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursorParam) {
    const decodedTs = decodeCursor(cursorParam)
    if (decodedTs) {
      query = query.lt('created_at', decodedTs)
    }
  }

  const { data: profiles, error } = await query

  if (error) {
    logger.error({ error: error.message }, 'admin students list failed')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null })
  }

  const hasMore = profiles.length > limit
  const page = hasMore ? profiles.slice(0, limit) : profiles
  const nextCursor = hasMore ? encodeCursor(page[page.length - 1].created_at) : null

  const userIds = page.map(p => p.id)

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('user_id')
    .in('user_id', userIds)
    .eq('is_active', true)

  // listUsers fetches up to 1000; matched against current page only
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 })

  const result = page.map(p => {
    const enrolledCount = enrollments?.filter(e => e.user_id === p.id).length ?? 0
    const authUser = authUsers.find(u => u.id === p.id)
    return {
      ...p,
      email: authUser?.email ?? '',
      enrolled_courses: enrolledCount,
    }
  })

  logger.info({ count: result.length, paginated: !!cursorParam }, 'admin students listed')
  return NextResponse.json({ items: result, nextCursor })
}
