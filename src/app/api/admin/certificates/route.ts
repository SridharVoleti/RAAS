import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { getAwardedStudents } from '@/lib/certificate-awards'
import { logger } from '@/lib/logger'

/**
 * Certificate award counts for every course in a certificate-enabled path.
 * Courses come straight from the DB, so new courses appear automatically.
 */
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  try {
    const supabase = createAdminClient()
    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, title_en, title_te, emoji, paths!inner(certificates_enabled)')
      .eq('paths.certificates_enabled', true)
      .order('order_index', { ascending: true })

    if (error) throw error

    const result = []
    for (const c of courses ?? []) {
      const students = await getAwardedStudents(c.id)
      result.push({
        courseId: c.id,
        title_en: c.title_en,
        title_te: c.title_te,
        emoji: c.emoji,
        awardedCount: students.length,
      })
    }

    return NextResponse.json({ courses: result })
  } catch (err) {
    logger.error({ error: String(err) }, 'admin.certificates.summary.failed')
    return NextResponse.json({ error: 'Failed to load certificate summary' }, { status: 500 })
  }
}
