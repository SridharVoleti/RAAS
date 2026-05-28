import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, PaymentConfirmSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const parsed = await parseBody(req, PaymentConfirmSchema)
  if (!parsed.success) return parsed.response
  const { paymentLogId } = parsed.data

  try {

    const supabase = await createAdminClient()

    // Fetch user_id and course_id from the payment log — never trust request body for these
    const { data: payment, error: fetchError } = await supabase
      .from('payment_logs')
      .select('user_id, course_id, status')
      .eq('id', paymentLogId)
      .single()

    if (fetchError || !payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    if (payment.status === 'paid') {
      logger.warn({ paymentLogId }, 'payment.confirm.duplicate')
      return NextResponse.json({ error: 'Already confirmed' }, { status: 400 })
    }

    await supabase.from('payment_logs').update({ status: 'paid' }).eq('id', paymentLogId)

    await supabase.from('enrollments').upsert({
      user_id: payment.user_id,
      course_id: payment.course_id,
      is_active: true,
      activated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id' })

    logger.info({ paymentLogId, userId: payment.user_id, courseId: payment.course_id }, 'payment.confirmed')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ paymentLogId, error: String(err) }, 'payment.confirm.failed')
    return NextResponse.json({ error: 'Confirmation failed' }, { status: 500 })
  }
}
