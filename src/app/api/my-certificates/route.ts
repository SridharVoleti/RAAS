import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCertificate, type CertificateData } from '@/lib/certificate'
import { logger } from '@/lib/logger'

/** All certificates the logged-in student has earned across their enrollments. */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    const certificates: CertificateData[] = []
    for (const e of enrollments ?? []) {
      const result = await getCertificate(e.course_id)
      if (result.ok) certificates.push(result.data)
    }

    certificates.sort((a, b) => b.completedAt.localeCompare(a.completedAt))

    return NextResponse.json({ certificates })
  } catch (err) {
    logger.error({ error: String(err) }, 'my_certificates.failed')
    return NextResponse.json({ error: 'Failed to load certificates' }, { status: 500 })
  }
}
