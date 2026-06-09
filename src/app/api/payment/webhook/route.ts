import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEnrollmentEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    )
  } catch {
    return false
  }
}

type RazorpayWebhookEvent = {
  event: string
  payload: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
      }
    }
    order?: {
      entity?: {
        id?: string
      }
    }
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? ''

  if (!secret) {
    logger.error({}, 'webhook.secret_missing')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  if (!verifySignature(rawBody, signature, secret)) {
    logger.warn({ sig: signature.slice(0, 8) }, 'webhook.invalid_signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let event: RazorpayWebhookEvent
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookEvent
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event: eventType, payload } = event

  // Only act on payment success events; acknowledge everything else
  if (eventType !== 'payment.captured' && eventType !== 'order.paid') {
    logger.info({ event: eventType }, 'webhook.ignored')
    return NextResponse.json({ received: true })
  }

  const orderId = payload.payment?.entity?.order_id
  const razorpayPaymentId = payload.payment?.entity?.id

  if (!orderId) {
    logger.warn({ event: eventType }, 'webhook.missing_order_id')
    return NextResponse.json({ error: 'Missing order_id in payload' }, { status: 400 })
  }

  logger.info({ event: eventType, orderId, razorpayPaymentId }, 'webhook.received')

  const supabase = await createAdminClient()

  const { data: payment, error: fetchError } = await supabase
    .from('payment_logs')
    .select('id, user_id, course_id, status')
    .eq('razorpay_order_id', orderId)
    .single()

  if (fetchError || !payment) {
    logger.error({ orderId }, 'webhook.payment_log_not_found')
    // Return 200 so Razorpay stops retrying; the order may belong to another environment
    return NextResponse.json({ received: true })
  }

  // Idempotency: already activated → ack without doing anything
  if (payment.status === 'paid') {
    logger.info({ orderId, paymentLogId: payment.id }, 'webhook.already_processed')
    return NextResponse.json({ received: true })
  }

  // Mark payment paid and record the Razorpay payment ID
  await supabase
    .from('payment_logs')
    .update({ status: 'paid', razorpay_payment_id: razorpayPaymentId ?? null })
    .eq('id', payment.id)

  // Activate enrollment
  await supabase
    .from('enrollments')
    .upsert({
      user_id:      payment.user_id,
      course_id:    payment.course_id,
      is_active:    true,
      activated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id' })

  logger.info(
    { orderId, paymentLogId: payment.id, userId: payment.user_id, courseId: payment.course_id },
    'webhook.enrollment_activated'
  )

  // Fire-and-forget — email failure must never break webhook ack
  await sendEnrollmentEmail(payment.user_id, payment.course_id)

  return NextResponse.json({ received: true })
}
