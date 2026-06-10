import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { renderNewsletterHtml } from '@/lib/email'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const SYNTHETIC_SUFFIX = '@mobile.srikrishnamargam.in'
const BCC_BATCH_SIZE   = 50
const FROM_EMAIL       = process.env.RESEND_FROM_EMAIL ?? 'Krishnamargam <noreply@srikrishnamargam.in>'
const APP_URL          = process.env.NEXT_PUBLIC_APP_URL ?? 'https://srikrishnamargam.in'

const BRAND = {
  fromEmail:      FROM_EMAIL,
  appUrl:         APP_URL,
  primaryColor:   '#f0b429',
  bgColor:        '#1a0f00',
  cardBg:         '#120a00',
  headerBg:       '#0d0800',
  borderColor:    '#3a2800',
  bodyTextColor:  '#f5e6c8',
  mutedTextColor: '#a07030',
  symbol:         'ॐ',
  brandNameLocal: 'కృష్ణమార్గం',
  brandNameEn:    'Krishnamargam',
  footerLine1:    'BabyStepsIndia.in · Krishnamargam',
  footerLine2:    'Vedic wisdom for the modern seeker',
  ctaLabel:       'Start Learning →',
  ctaPath:        '/my-courses',
}

async function getAllUserEmails(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
): Promise<string[]> {
  const emails: string[] = []
  let page = 1
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const user of data.users) {
      if (user.email && !user.email.endsWith(SYNTHETIC_SUFFIX)) {
        emails.push(user.email)
      }
    }
    if (data.users.length < 1000) break
    page++
  }
  return emails
}

/** GET — live recipient count shown in the composer. */
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()
  const emails   = await getAllUserEmails(supabase)
  return NextResponse.json({ recipientCount: emails.length })
}

const sendSchema = z.object({
  subject:    z.string().min(1).max(300),
  htmlBody:   z.string().min(1),
  /**
   * Zero-based index of the batch to send on this request.
   * The client starts at 0, reads `hasMore` from the response, then
   * increments and calls again until `hasMore` is false.
   */
  batchIndex: z.number().int().min(0).default(0),
})

/**
 * POST — send ONE batch (batchIndex) and return progress metadata so the
 * client can decide whether to trigger the next batch.
 *
 * Response shape:
 *   { sent, batchIndex, totalBatches, totalRecipients, hasMore }
 *
 * Why one-batch-per-request instead of a server-side loop:
 *   • Serverless functions have short timeouts — a large list could exceed them.
 *   • The client can show real-time progress and offer a Cancel button between batches.
 *   • Each request is fast and independently retryable.
 */
export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const body   = await req.json().catch(() => null)
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { subject, htmlBody, batchIndex } = parsed.data

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    logger.error({}, 'newsletter.resend_key_missing')
    return NextResponse.json(
      { error: 'Email service not configured — set RESEND_API_KEY in Vercel.' },
      { status: 503 },
    )
  }

  const resend   = new Resend(apiKey)
  const supabase = await createAdminClient()

  const emails = await getAllUserEmails(supabase)
  if (emails.length === 0) {
    return NextResponse.json({ error: 'No registered users found.' }, { status: 400 })
  }

  const totalBatches    = Math.ceil(emails.length / BCC_BATCH_SIZE)
  const totalRecipients = emails.length
  const start           = batchIndex * BCC_BATCH_SIZE
  const batch           = emails.slice(start, start + BCC_BATCH_SIZE)

  // Guard against an out-of-range batchIndex (e.g. stale client retry)
  if (batch.length === 0) {
    return NextResponse.json({
      sent: 0, batchIndex, totalBatches, totalRecipients, hasMore: false,
    })
  }

  const html = renderNewsletterHtml(htmlBody, subject, BRAND)

  logger.info(
    { admin: admin.email, subject, batchIndex, batchSize: batch.length, totalBatches },
    'newsletter.batch.sending',
  )

  const { error } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      FROM_EMAIL,  // self; all real recipients are in BCC
    bcc:     batch,
    subject,
    html,
  })

  if (error) {
    logger.error({ error, batchIndex }, 'newsletter.batch.failed')
    return NextResponse.json(
      { error: `Batch ${batchIndex + 1}/${totalBatches} failed: ${error.message}` },
      { status: 500 },
    )
  }

  const hasMore = batchIndex + 1 < totalBatches

  logger.info(
    { admin: admin.email, subject, batchIndex, sent: batch.length, hasMore },
    'newsletter.batch.sent',
  )

  return NextResponse.json({
    sent:             batch.length,
    batchIndex,
    totalBatches,
    totalRecipients,
    hasMore,
  })
}
