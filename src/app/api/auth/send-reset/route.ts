import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'Krishnamargam <noreply@krishnamargam.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://krishnamargam.com'

function buildResetEmail(resetLink: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#1a0f00;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0f00;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#120a00;border-radius:12px;border:1px solid #3a2800;overflow:hidden;">
          <tr>
            <td style="background:#0d0800;padding:24px;text-align:center;border-bottom:1px solid #3a2800;">
              <div style="color:#f0b429;font-size:36px;line-height:1;">ॐ</div>
              <div style="color:#f0b429;font-size:20px;font-weight:700;letter-spacing:1px;margin-top:8px;">కృష్ణమార్గం</div>
              <div style="color:#a07030;font-size:13px;margin-top:2px;">Krishnamargam</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <h1 style="color:#f0b429;font-size:22px;font-weight:700;margin:0 0 16px 0;">Reset Your Password</h1>
              <p style="color:#f5e6c8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
                We received a request to reset the password for your Krishnamargam account.
                Click the button below to choose a new password. This link expires in 1 hour.
              </p>
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${resetLink}"
                   style="display:inline-block;background:#f0b429;color:#1a0f00;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
                  Reset Password →
                </a>
              </div>
              <p style="color:#a07030;font-size:13px;line-height:1.6;margin:0;">
                If you did not request this, you can safely ignore this email.
                Your password will not change.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #3a2800;text-align:center;">
              <p style="color:#a07030;font-size:12px;margin:0;line-height:1.8;">
                BabyStepsIndia.in · Krishnamargam<br>
                Vedic wisdom for the modern seeker
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

export async function POST(req: Request) {
  let email: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    logger.error('send-reset: RESEND_API_KEY not configured')
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  try {
    const supabase = await createAdminClient()

    // Check if the account exists
    // `page` must be passed explicitly — supabase-js sends page='' when omitted,
    // which the Auth admin API 500s on ("Database error finding users").
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (listError) {
      logger.error({ error: listError.message }, 'send-reset.listUsers.failed')
      return NextResponse.json({ error: 'Could not verify email. Please try again.' }, { status: 500 })
    }

    const userExists = users.some(u => u.email?.toLowerCase() === email)
    if (!userExists) {
      return NextResponse.json({ exists: false }, { status: 404 })
    }

    // Generate the recovery link via Supabase Admin (no email sent by Supabase)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${APP_URL}/auth/reset-password` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      logger.error({ error: linkError?.message }, 'send-reset.generateLink.failed')
      return NextResponse.json({ error: 'Could not generate reset link. Please try again.' }, { status: 500 })
    }

    const resetLink = linkData.properties.action_link

    // Send via Resend SDK directly — same path that already works for enrollment emails
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: [email],
      subject: 'Reset your Krishnamargam password',
      html: buildResetEmail(resetLink),
    })

    if (sendError) {
      logger.error({ error: String(sendError) }, 'send-reset.resend.failed')
      return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
    }

    logger.info({ email }, 'send-reset.sent')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ error: String(err) }, 'send-reset.failed')
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
