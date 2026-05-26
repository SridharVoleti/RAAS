import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { sendEnrollmentEmail } from '@/lib/email'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const supabase = await createAdminClient()

  // Get the payment log
  const { data: payment, error: fetchError } = await supabase
    .from('payment_logs')
    .select('user_id, course_id, status')
    .eq('id', Number(id))
    .single()

  if (fetchError || !payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  if (payment.status === 'paid') return NextResponse.json({ error: 'Already confirmed' }, { status: 400 })

  // Mark payment as paid
  await supabase
    .from('payment_logs')
    .update({ status: 'paid' })
    .eq('id', Number(id))

  // Activate enrollment
  await supabase
    .from('enrollments')
    .upsert({
      user_id:      payment.user_id,
      course_id:    payment.course_id,
      is_active:    true,
      activated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id' })

  sendEnrollmentEmail(payment.user_id, payment.course_id)
  return NextResponse.json({ success: true })
}
