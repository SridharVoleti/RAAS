import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser } from '@/lib/admin'
import { logger } from '@/lib/logger'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('donations')
    .select(`
      id, amount, purpose, status, receipt_number,
      razorpay_payment_id, created_at, course_id, donor_state, declaration_accepted,
      courses ( title_en ),
      profiles!donations_user_id_fkey ( full_name )
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    logger.error({ err: error }, 'admin.donations.get.failed')
    return NextResponse.json({ error: 'Failed to fetch donations' }, { status: 500 })
  }

  // Fetch donor emails via admin auth API (not available via join)
  const userIds = [...new Set((data ?? []).map((d: Record<string, unknown>) => d.user_id as string).filter(Boolean))]
  const emailMap: Record<string, string> = {}
  for (const uid of userIds) {
    const { data: { user } } = await supabase.auth.admin.getUserById(uid)
    if (user?.email) emailMap[uid] = user.email
  }

  const rows = (data ?? []).map((d: Record<string, unknown>) => ({
    id:                  d.id,
    amount:              d.amount,
    purpose:             d.purpose,
    status:              d.status,
    receipt_number:      d.receipt_number,
    razorpay_payment_id: d.razorpay_payment_id,
    created_at:          d.created_at,
    donor_state:         d.donor_state ?? null,
    declaration_accepted: d.declaration_accepted ?? false,
    donor_name:          (d.profiles as { full_name?: string } | null)?.full_name ?? '',
    donor_email:         emailMap[d.user_id as string] ?? '',
    course_title:        (d.courses as { title_en?: string } | null)?.title_en ?? null,
  }))

  return NextResponse.json(rows)
}
