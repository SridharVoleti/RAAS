import { NextResponse } from 'next/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = createAdminClient()
  const { data: declarations, error } = await supabase
    .from('prior_learning_declarations')
    .select('*, courses(title_en)')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error({ error }, 'admin.priorLearning.list.error')
    return NextResponse.json({ error: 'Failed to fetch registrations' }, { status: 500 })
  }

  // Attach student names
  const userIds = [...new Set((declarations ?? []).map(d => d.user_id))]
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', userIds)
    : { data: [] }
  const nameById = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

  const rows = (declarations ?? []).map(d => ({
    ...d,
    student_name: nameById.get(d.user_id) ?? '—',
  }))

  return NextResponse.json({ declarations: rows })
}
