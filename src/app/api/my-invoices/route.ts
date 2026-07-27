import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('course_purchases')
    .select('id, amount_usd, status, created_at, confirmed_at, receipt_number, courses ( title_en )')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error({ err: error, userId: user.id }, 'my_invoices.get.failed')
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }

  const invoices = (data ?? []).map((p: Record<string, unknown>) => ({
    id:             p.id,
    courseTitle:    (p.courses as { title_en?: string } | null)?.title_en ?? '—',
    amountUsd:      p.amount_usd,
    status:         p.status,
    createdAt:      p.created_at,
    confirmedAt:    p.confirmed_at,
    receiptNumber:  p.receipt_number,
  }))

  return NextResponse.json({ invoices })
}
