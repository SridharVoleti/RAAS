import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient } from '@/lib/supabase/server'
import { parseBody, PaymentInitiateSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  const parsed = await parseBody(req, PaymentInitiateSchema)
  if (!parsed.success) return parsed.response
  const { courseId, amount } = parsed.data

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    logger.error({}, 'payment.initiate.razorpay_keys_missing')
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
  }

  const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    logger.info({ userId: user.id, courseId, amount }, 'payment.initiate')

    // Create order in Razorpay (amount in paise)
    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100),
      currency: 'INR',
      receipt:  `rcpt_${courseId}_${Date.now()}`,
    })

    const { error } = await supabase.from('payment_logs').insert({
      user_id:           user.id,
      course_id:         courseId,
      amount,
      status:            'created',
      razorpay_order_id: order.id,
    })
    if (error) throw error

    await supabase.from('enrollments').upsert({
      user_id:   user.id,
      course_id: courseId,
      is_active: false,
    }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })

    logger.info({ userId: user.id, courseId, orderId: order.id }, 'payment.initiated')
    return NextResponse.json({
      razorpayOrderId: order.id,
      razorpayKeyId:   process.env.RAZORPAY_KEY_ID,
      amount:          order.amount,
    })
  } catch (err) {
    logger.error({ error: String(err) }, 'payment.initiate.failed')
    return NextResponse.json({ error: 'Payment initiation failed' }, { status: 500 })
  }
}
