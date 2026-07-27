import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { logger } from '@/lib/logger'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('course_purchases')
    .select(`
      id, user_id, amount_usd, status, payment_reference, created_at,
      courses ( id, title_en ),
      profiles!course_purchases_user_id_fkey ( full_name )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    logger.error({ err: error }, 'admin.course_purchases.get.failed')
    return NextResponse.json({ error: 'Failed to fetch course purchases' }, { status: 500 })
  }

  const userIds = [...new Set((data ?? []).map((p: Record<string, unknown>) => p.user_id as string))]
  const emailMap: Record<string, string> = {}
  for (const uid of userIds) {
    const { data: { user } } = await supabase.auth.admin.getUserById(uid)
    if (user?.email) emailMap[uid] = user.email
  }

  const rows = (data ?? []).map((p: Record<string, unknown>) => ({
    id:                 p.id,
    amount_usd:         p.amount_usd,
    status:             p.status,
    payment_reference:  p.payment_reference,
    created_at:         p.created_at,
    student_name:       (p.profiles as { full_name?: string } | null)?.full_name ?? '—',
    student_email:      emailMap[p.user_id as string] ?? '',
    course_title:       (p.courses as { title_en?: string } | null)?.title_en ?? '—',
  }))

  return NextResponse.json(rows)
}
