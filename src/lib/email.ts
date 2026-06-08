import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

// ── Reusable core ─────────────────────────────────────────────────────────────
// BrandConfig, applyVariables, and renderHtml have no project-specific
// dependencies — copy them verbatim to any Next.js + Resend project.

export interface BrandConfig {
  fromEmail:      string
  appUrl:         string
  primaryColor:   string
  bgColor:        string
  cardBg:         string
  headerBg:       string
  borderColor:    string
  bodyTextColor:  string
  mutedTextColor: string
  symbol:         string
  brandNameLocal: string
  brandNameEn:    string
  footerLine1:    string
  footerLine2:    string
  ctaLabel:       string
  ctaPath:        string
}

/** Replace all {{key}} tokens in text with their values. Unknown keys are left as-is. */
export function applyVariables(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (out, [key, val]) => out.replaceAll(`{{${key}}}`, val),
    text
  )
}

/** Wrap a plain-text body in a fully inlined branded HTML email. */
export function renderHtml(body: string, subject: string, cfg: BrandConfig): string {
  const bodyHtml = body
    .split('\n')
    .map(line =>
      line.trim() === ''
        ? '<br>'
        : `<p style="color:${cfg.bodyTextColor};font-size:15px;line-height:1.7;margin:0 0 4px 0;">${line}</p>`
    )
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${cfg.bgColor};font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${cfg.bgColor};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${cfg.cardBg};border-radius:12px;border:1px solid ${cfg.borderColor};overflow:hidden;">

          <tr>
            <td style="background:${cfg.headerBg};padding:24px;text-align:center;border-bottom:1px solid ${cfg.borderColor};">
              <div style="color:${cfg.primaryColor};font-size:36px;line-height:1;">${cfg.symbol}</div>
              <div style="color:${cfg.primaryColor};font-size:20px;font-weight:700;letter-spacing:1px;margin-top:8px;">${cfg.brandNameLocal}</div>
              <div style="color:${cfg.mutedTextColor};font-size:13px;margin-top:2px;">${cfg.brandNameEn}</div>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 40px;">
              <h1 style="color:${cfg.primaryColor};font-size:22px;font-weight:700;margin:0 0 24px 0;">${subject}</h1>
              ${bodyHtml}
              <div style="text-align:center;margin-top:32px;">
                <a href="${cfg.appUrl}${cfg.ctaPath}"
                   style="display:inline-block;background:${cfg.primaryColor};color:${cfg.bgColor};text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
                  ${cfg.ctaLabel}
                </a>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px;border-top:1px solid ${cfg.borderColor};text-align:center;">
              <p style="color:${cfg.mutedTextColor};font-size:12px;margin:0;line-height:1.8;">
                ${cfg.footerLine1}<br>
                ${cfg.footerLine2}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Krishnamargam brand config ────────────────────────────────────────────────

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
  ctaLabel:       'Start Learning →',
  ctaPath:        '/my-courses',
}

// ── Default templates (fallback when DB has no record for a type) ─────────────

const DEFAULTS = {
  enrollment: {
    subject: "You're enrolled in {{course_en}} — Krishnamargam",
    body: `Namaskar {{name}},

You are now enrolled in {{course_en}} ({{course_te}}).

Your spiritual journey begins now. May this path bring you clarity, wisdom, and peace.

Click below to start learning: {{link}}`,
  },
  welcome: {
    subject: 'Welcome to Krishnamargam, {{name}}!',
    body: `Namaskar {{name}},

Welcome to Krishnamargam — your gateway to ancient Vedic wisdom.

Explore our courses and begin your spiritual journey today.

ॐ శాంతి శాంతి శాంతిః`,
  },
  payment_received: {
    subject: 'Payment confirmed — {{course_en}}',
    body: `Namaskar {{name}},

Thank you for your payment of ₹{{amount}} for {{course_en}}.

Your enrollment is now active. Begin your journey whenever you're ready.

Order ID: {{order_id}}`,
  },
} as const

// ── Internal helpers ──────────────────────────────────────────────────────────

function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    logger.error({}, 'email.resend_key_missing')
    return null
  }
  return new Resend(key)
}

// ── Email senders ─────────────────────────────────────────────────────────────
// All senders are fire-and-forget safe: they catch every error and never
// throw. Enrollment / payment flows must never be blocked by email failures.

export async function sendEnrollmentEmail(userId: string, courseId: number): Promise<void> {
  try {
    const resend = getResendClient()
    if (!resend) return

    const supabase = await createAdminClient()
    const [
      { data: { user } },
      { data: profile },
      { data: course },
      { data: template },
    ] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase.from('profiles').select('full_name').eq('id', userId).single(),
      supabase.from('courses').select('title_en, title_te').eq('id', courseId).single(),
      supabase.from('email_templates').select('subject, body').eq('type', 'enrollment').single(),
    ])

    if (!user?.email || !profile || !course) {
      logger.warn({ userId, courseId }, 'email.enrollment.missing_data')
      return
    }

    const vars = {
      name:      profile.full_name || 'Student',
      course_en: course.title_en,
      course_te: course.title_te,
      link:      `${BRAND.appUrl}/my-courses`,
    }

    const subject = applyVariables(template?.subject ?? DEFAULTS.enrollment.subject, vars)
    const body    = applyVariables(template?.body    ?? DEFAULTS.enrollment.body,    vars)

    await resend.emails.send({
      from:    BRAND.fromEmail,
      to:      [user.email],
      subject,
      html:    renderHtml(body, subject, BRAND),
    })

    logger.info({ userId, courseId, to: user.email }, 'email.enrollment.sent')
  } catch (err) {
    logger.error({ err, userId, courseId }, 'email.enrollment.failed')
  }
}

export async function sendWelcomeEmail(userId: string): Promise<void> {
  try {
    const resend = getResendClient()
    if (!resend) return

    const supabase = await createAdminClient()
    const [
      { data: { user } },
      { data: profile },
    ] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase.from('profiles').select('full_name').eq('id', userId).single(),
    ])

    if (!user?.email) {
      logger.warn({ userId }, 'email.welcome.missing_user')
      return
    }

    const vars = { name: profile?.full_name || 'Student' }
    const subject = applyVariables(DEFAULTS.welcome.subject, vars)
    const body    = applyVariables(DEFAULTS.welcome.body,    vars)

    const cfg: BrandConfig = { ...BRAND, ctaPath: '/explore', ctaLabel: 'Explore Courses →' }

    await resend.emails.send({
      from:    BRAND.fromEmail,
      to:      [user.email],
      subject,
      html:    renderHtml(body, subject, cfg),
    })

    logger.info({ userId, to: user.email }, 'email.welcome.sent')
  } catch (err) {
    logger.error({ err, userId }, 'email.welcome.failed')
  }
}

/** Send a payment receipt email. amount is in the smallest currency unit (paise). */
export async function sendPaymentReceivedEmail(
  userId: string,
  courseId: number,
  amountPaise: number,
  orderId: string,
): Promise<void> {
  try {
    const resend = getResendClient()
    if (!resend) return

    const supabase = await createAdminClient()
    const [
      { data: { user } },
      { data: profile },
      { data: course },
    ] = await Promise.all([
      supabase.auth.admin.getUserById(userId),
      supabase.from('profiles').select('full_name').eq('id', userId).single(),
      supabase.from('courses').select('title_en').eq('id', courseId).single(),
    ])

    if (!user?.email || !course) {
      logger.warn({ userId, courseId }, 'email.payment.missing_data')
      return
    }

    const vars = {
      name:      profile?.full_name || 'Student',
      course_en: course.title_en,
      amount:    (amountPaise / 100).toFixed(2),
      order_id:  orderId,
    }

    const subject = applyVariables(DEFAULTS.payment_received.subject, vars)
    const body    = applyVariables(DEFAULTS.payment_received.body,    vars)

    const cfg: BrandConfig = { ...BRAND, ctaPath: '/my-courses', ctaLabel: 'Go to My Courses →' }

    await resend.emails.send({
      from:    BRAND.fromEmail,
      to:      [user.email],
      subject,
      html:    renderHtml(body, subject, cfg),
    })

    logger.info({ userId, courseId, orderId, to: user.email }, 'email.payment.sent')
  } catch (err) {
    logger.error({ err, userId, courseId, orderId }, 'email.payment.failed')
  }
}
