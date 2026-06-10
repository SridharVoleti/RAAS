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

type AdminClient = ReturnType<typeof createAdminClient>

function isReal(email: string | undefined): email is string {
  return !!email && !email.endsWith(SYNTHETIC_SUFFIX)
}

/**
 * Fetch all real user emails.
 *
 * Primary:  auth.admin.listUsers — one paginated call.
 * Fallback: profiles table → auth.admin.getUserById — used when listUsers
 *           returns an error (e.g. API version quirk, permission edge case).
 *           We know profiles works because the Students page relies on it.
 *
 * Throws on complete failure so callers can surface a diagnostic to the admin.
 */
async function getAllUserEmails(supabase: AdminClient): Promise<string[]> {

  // ── Primary: auth.admin.listUsers ─────────────────────────────────────────
  const emails: string[] = []
  let primaryOk = false

  try {
    let page = 1
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })

      if (error) {
        logger.warn(
          { error: error.message, status: (error as { status?: number }).status },
          'newsletter.listUsers.error — will try profiles fallback',
        )
        break
      }

      if (!data?.users?.length) break   // no more pages

      for (const user of data.users) {
        if (isReal(user.email)) emails.push(user.email)
      }

      primaryOk = true

      if (data.users.length < 1000) break
      page++
    }
  } catch (err) {
    logger.warn({ err }, 'newsletter.listUsers.exception — will try profiles fallback')
  }

  if (primaryOk && emails.length > 0) {
    logger.info({ count: emails.length }, 'newsletter.listUsers.ok')
    return emails
  }

  // ── Fallback: profiles → getUserById ──────────────────────────────────────
  logger.info({}, 'newsletter.fallback.start')

  const { data: profiles, error: profilesErr } = await supabase
    .from('profiles')
    .select('id')

  if (profilesErr) {
    throw new Error(
      `listUsers failed AND profiles query failed: ${profilesErr.message}`,
    )
  }

  if (!profiles?.length) return []

  // Fetch in parallel chunks of 10 to stay well within rate limits
  const fallbackEmails: string[] = []
  const CHUNK = 10
  for (let i = 0; i < profiles.length; i += CHUNK) {
    const chunk = profiles.slice(i, i + CHUNK)
    const results = await Promise.all(
      chunk.map(p => supabase.auth.admin.getUserById(p.id)),
    )
    for (const { data: { user }, error: ue } of results) {
      if (ue) { logger.warn({ error: ue.message }, 'newsletter.fallback.getUserById.error'); continue }
      if (isReal(user?.email)) fallbackEmails.push(user!.email!)
    }
  }

  logger.info({ count: fallbackEmails.length }, 'newsletter.fallback.ok')
  return fallbackEmails
}

// ── GET — live recipient count for the composer UI ────────────────────────────

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = createAdminClient()
  try {
    const emails = await getAllUserEmails(supabase)
    return NextResponse.json({ recipientCount: emails.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ err }, 'newsletter.get.failed')
    // Return count=0 with the diagnostic so the UI can display it
    return NextResponse.json({ recipientCount: 0, fetchError: message }, { status: 500 })
  }
}

// ── POST — send one batch ─────────────────────────────────────────────────────

const sendSchema = z.object({
  subject:    z.string().min(1).max(300),
  htmlBody:   z.string().min(1),
  batchIndex: z.number().int().min(0).default(0),
})

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
  const supabase = createAdminClient()

  let emails: string[]
  try {
    emails = await getAllUserEmails(supabase)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error({ err }, 'newsletter.post.getEmails.failed')
    return NextResponse.json({ error: `Could not load recipients: ${message}` }, { status: 500 })
  }

  if (emails.length === 0) {
    return NextResponse.json({ error: 'No registered users found.' }, { status: 400 })
  }

  const totalBatches    = Math.ceil(emails.length / BCC_BATCH_SIZE)
  const totalRecipients = emails.length
  const start           = batchIndex * BCC_BATCH_SIZE
  const batch           = emails.slice(start, start + BCC_BATCH_SIZE)

  if (batch.length === 0) {
    return NextResponse.json({ sent: 0, batchIndex, totalBatches, totalRecipients, hasMore: false })
  }

  const html = renderNewsletterHtml(htmlBody, subject, BRAND)

  logger.info(
    { admin: admin.email, subject, batchIndex, batchSize: batch.length, totalBatches },
    'newsletter.batch.sending',
  )

  const { error } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      FROM_EMAIL,
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
  logger.info({ admin: admin.email, batchIndex, sent: batch.length, hasMore }, 'newsletter.batch.sent')

  return NextResponse.json({ sent: batch.length, batchIndex, totalBatches, totalRecipients, hasMore })
}
