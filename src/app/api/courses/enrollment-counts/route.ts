import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// Public, aggregate-only endpoint: how many students are actively enrolled
// per course. Uses the admin client because RLS restricts the enrollments
// table to each user's own rows — no per-user data is exposed here, only
// counts grouped by course_id.
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('is_active', true)

  if (error) {
    logger.error({ error: error.message }, 'courses.enrollment-counts.failed')
    return NextResponse.json({ error: 'Failed to load enrollment counts' }, { status: 500 })
  }

  const counts: Record<number, number> = {}
  for (const row of data ?? []) {
    counts[row.course_id] = (counts[row.course_id] ?? 0) + 1
  }

  const response = NextResponse.json({ counts })
  response.headers.set('Cache-Control', 'public, max-age=300')
  return response
}
