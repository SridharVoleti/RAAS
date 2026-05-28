import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseBody, PaymentInitiateSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  const parsed = await parseBody(req, PaymentInitiateSchema)
  if (!parsed.success) return parsed.response
  const { courseId, amount } = parsed.data

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    logger.info({ userId: user.id, courseId, amount }, 'payment.initiate')

    const { error } = await supabase.from('payment_logs').insert({
      user_id: user.id,
      course_id: courseId,
      amount: amount,
      status: 'created',
    })

    // Also create pending enrollment record
    await supabase.from('enrollments').upsert({
      user_id: user.id,
      course_id: courseId,
      is_active: false,
    }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })

    if (error) throw error
    logger.info({ userId: user.id, courseId, amount }, 'payment.initiated')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ error: String(err) }, 'payment.initiate.failed')
    return NextResponse.json({ error: 'Payment initiation failed' }, { status: 500 })
  }
}
