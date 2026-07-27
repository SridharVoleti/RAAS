import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { isIndianLocation } from '@/lib/indian-states'
import { z } from 'zod'

const DonateSchema = z.object({
  amount:              z.number().int().min(10).max(100000), // rupees, min ₹10 max ₹1,00,000
  purpose:             z.enum(['general', 'course']).default('general'),
  courseId:            z.number().int().optional(),
  state:               z.string().min(1),
  declarationAccepted: z.boolean(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = DonateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { amount, purpose, courseId, state, declarationAccepted } = parsed.data

  if (!isIndianLocation(state)) {
    return NextResponse.json(
      { error: 'Donations from outside India cannot be accepted — Sri Krishnamargam Trust is not FCRA-registered.' },
      { status: 403 },
    )
  }

  if (!declarationAccepted) {
    return NextResponse.json({ error: 'You must accept the donor declaration to proceed.' }, { status: 400 })
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    logger.error({}, 'donate.initiate.razorpay_keys_missing')
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const razorpay = new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })

  try {
    const amountPaise = amount * 100
    const order = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt:  `don_${user.id.slice(0, 8)}_${Date.now()}`,
      notes:    { type: 'donation', purpose, userId: user.id },
    })

    const { error } = await supabase.from('donations').insert({
      user_id:              user.id,
      amount:               amountPaise,
      purpose,
      course_id:            courseId ?? null,
      status:               'created',
      razorpay_order_id:    order.id,
      donor_state:          state,
      declaration_accepted: declarationAccepted,
    })
    if (error) throw error

    logger.info({ userId: user.id, amount, purpose, state, orderId: order.id }, 'donate.initiated')

    return NextResponse.json({
      razorpayOrderId: order.id,
      razorpayKeyId:   process.env.RAZORPAY_KEY_ID,
      amount:          order.amount,
    })
  } catch (err) {
    logger.error({ err }, 'donate.initiate.failed')
    return NextResponse.json({ error: 'Donation initiation failed' }, { status: 500 })
  }
}
