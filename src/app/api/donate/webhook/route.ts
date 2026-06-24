import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { sendDonationReceiptEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

function generateReceiptNumber(): string {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `KM-DON-${date}-${rand}`
}

type WebhookEvent = {
  event: string
  payload: {
    payment?: { entity?: { id?: string; order_id?: string } }
  }
}

export async function POST(req: Request) {
  const rawBody  = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret   = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

  if (!secret) {
    logger.error({}, 'donate.webhook.secret_missing')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  if (!verifySignature(rawBody, signature, secret)) {
    logger.warn({}, 'donate.webhook.invalid_signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: WebhookEvent
  try { event = JSON.parse(rawBody) as WebhookEvent }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (event.event !== 'payment.captured' && event.event !== 'order.paid') {
    return NextResponse.json({ received: true })
  }

  const orderId          = event.payload.payment?.entity?.order_id
  const razorpayPaymentId = event.payload.payment?.entity?.id

  if (!orderId) return NextResponse.json({ received: true })

  const supabase = await createAdminClient()

  const { data: donation, error: fetchErr } = await supabase
    .from('donations')
    .select('id, user_id, amount, purpose, course_id, status')
    .eq('razorpay_order_id', orderId)
    .single()

  if (fetchErr || !donation) {
    logger.info({ orderId }, 'donate.webhook.not_found_skipped')
    return NextResponse.json({ received: true })
  }

  if (donation.status === 'paid') {
    return NextResponse.json({ received: true })
  }

  const receiptNumber = generateReceiptNumber()

  await supabase
    .from('donations')
    .update({
      status:             'paid',
      razorpay_payment_id: razorpayPaymentId ?? null,
      receipt_number:     receiptNumber,
    })
    .eq('id', donation.id)

  logger.info({ orderId, donationId: donation.id, receiptNumber }, 'donate.webhook.paid')

  // Resolve course name for receipt if this is a course donation
  let courseName: string | undefined
  if (donation.purpose === 'course' && donation.course_id) {
    const { data: course } = await supabase
      .from('courses')
      .select('title_en')
      .eq('id', donation.course_id)
      .single()
    courseName = course?.title_en
  }

  await sendDonationReceiptEmail(
    donation.user_id,
    donation.amount,
    receiptNumber,
    donation.purpose as 'general' | 'course',
    courseName,
  )

  return NextResponse.json({ received: true })
}
