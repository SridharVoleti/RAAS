import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { sendEnrollmentEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

function receiptNumber(id: number): string {
  return `INT-${new Date().getFullYear()}-${String(id).padStart(5, '0')}`
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const purchaseId = Number(id)
  const supabase = await createAdminClient()

  const { data: purchase, error: fetchError } = await supabase
    .from('course_purchases')
    .select('user_id, course_id, status')
    .eq('id', purchaseId)
    .single()

  if (fetchError || !purchase) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
  if (purchase.status !== 'pending') {
    logger.warn({ purchaseId }, 'admin.course_purchase.confirm.duplicate')
    return NextResponse.json({ error: 'Already processed' }, { status: 400 })
  }

  await supabase
    .from('course_purchases')
    .update({
      status:         'confirmed',
      confirmed_at:   new Date().toISOString(),
      receipt_number: receiptNumber(purchaseId),
    })
    .eq('id', purchaseId)

  await supabase
    .from('enrollments')
    .upsert({
      user_id:      purchase.user_id,
      course_id:    purchase.course_id,
      is_active:    true,
      activated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id' })

  logger.info({ purchaseId, userId: purchase.user_id, courseId: purchase.course_id }, 'admin.course_purchase.confirmed')
  await sendEnrollmentEmail(purchase.user_id, purchase.course_id)
  return NextResponse.json({ success: true })
}
