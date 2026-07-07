import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient, createAdminClient } from '@/lib/supabase/server'
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

    // Always use the server-side course price — never trust the client-supplied amount
    const adminSupabase = createAdminClient()
    const { data: course } = await adminSupabase
      .from('courses')
      .select('price, is_published, is_free')
      .eq('id', courseId)
      .single()

    if (!course || !course.is_published) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    if (course.is_free) {
      return NextResponse.json({ error: 'Course is free — no payment required' }, { status: 400 })
    }
    const serverAmount = Number(course.price ?? 0)
    if (serverAmount <= 0) {
      return NextResponse.json({ error: 'Course has no valid price set' }, { status: 400 })
    }

    logger.info({ userId: user.id, courseId, serverAmount }, 'payment.initiate')

    // Create order in Razorpay (amount in paise) using server-verified price
    const order = await razorpay.orders.create({
      amount:   Math.round(serverAmount * 100),
      currency: 'INR',
      receipt:  `rcpt_${courseId}_${Date.now()}`,
    })

    const { error } = await supabase.from('payment_logs').insert({
      user_id:           user.id,
      course_id:         courseId,
      amount:            serverAmount,
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
