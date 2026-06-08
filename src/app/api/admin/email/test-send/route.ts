import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAdminUser, forbidden } from '@/lib/admin'
import { renderHtml, BrandConfig } from '@/lib/email'
import { logger } from '@/lib/logger'

const BRAND: BrandConfig = {
  fromEmail:      process.env.RESEND_FROM_EMAIL ?? 'Krishnamargam <noreply@krishnamargam.com>',
  appUrl:         process.env.NEXT_PUBLIC_APP_URL ?? 'https://krishnamargam.com',
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
  ctaLabel:       'Open Admin Panel →',
  ctaPath:        '/admin',
}

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 503 })
  }

  let to: string = admin.email ?? ''
  try {
    const body = await req.json()
    if (typeof body?.to === 'string' && body.to.includes('@')) to = body.to
  } catch {
    // body is optional — use admin email as default
  }

  if (!to) {
    return NextResponse.json({ error: 'Could not determine recipient address' }, { status: 400 })
  }

  const subject = 'Krishnamargam — Email test'
  const bodyText = `This is a test email sent from the Krishnamargam admin panel.

If you received this, Resend is correctly configured.

Sent at: ${new Date().toISOString()}`

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from:    BRAND.fromEmail,
      to:      [to],
      subject,
      html:    renderHtml(bodyText, subject, BRAND),
    })

    logger.info({ to, emailId: result.data?.id }, 'email.test.sent')
    return NextResponse.json({ success: true, to, emailId: result.data?.id })
  } catch (err) {
    logger.error({ err, to }, 'email.test.failed')
    return NextResponse.json({ error: 'Failed to send test email', detail: String(err) }, { status: 500 })
  }
}
