import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'Krishnamargam <noreply@krishnamargam.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://krishnamargam.com'

function buildConfirmEmail(confirmLink: string, fullName: string): string {
  const displayName = fullName || 'Seeker'
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
              <h1 style="color:#f0b429;font-size:22px;font-weight:700;margin:0 0 16px 0;">Welcome, ${displayName}!</h1>
              <p style="color:#f5e6c8;font-size:15px;line-height:1.7;margin:0 0 24px 0;">
                Namaskar! Thank you for registering with Krishnamargam. Click the button below to confirm your email address and activate your account.
              </p>
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${confirmLink}"
                   style="display:inline-block;background:#f0b429;color:#1a0f00;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
                  Confirm Email →
                </a>
              </div>
              <p style="color:#a07030;font-size:13px;line-height:1.6;margin:0;">
                If you did not create this account, you can safely ignore this email.
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
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { email, password, fullName, fathersName, username, address, city, mobile, avatarInitials, referralSource } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  if (!process.env.RESEND_API_KEY) {
    logger.error('register: RESEND_API_KEY not configured')
    return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })
  }

  try {
    const supabase = await createAdminClient()

    // Create user + generate confirmation link without triggering Supabase SMTP
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: {
          full_name: fullName ?? '',
          fathers_name: fathersName ?? '',
          username: username ?? '',
          address: address ?? '',
          city: city ?? '',
          mobile: mobile ?? '',
          avatar_initials: avatarInitials ?? '',
          referral_source: referralSource ?? '',
        },
        redirectTo: `${APP_URL}/auth/callback`,
      },
    })

    if (linkError) {
      logger.error({ error: linkError.message }, 'register.generateLink.failed')
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    const confirmLink = linkData.properties?.action_link
    if (!confirmLink) {
      logger.error('register.generateLink: no action_link in response')
      return NextResponse.json({ error: 'Could not generate confirmation link' }, { status: 500 })
    }

    // Send confirmation email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: [email],
      subject: 'Confirm your Krishnamargam account',
      html: buildConfirmEmail(confirmLink, fullName ?? ''),
    })

    if (sendError) {
      logger.error({ error: JSON.stringify(sendError) }, 'register.resend.failed')
      if (process.env.NODE_ENV !== 'production') {
        // Dev fallback: log the link so registration can be tested without a verified Resend domain
        logger.info({ confirmLink }, 'register.dev: paste this link to confirm the account')
        return NextResponse.json({ success: true })
      }
      return NextResponse.json({ error: 'Account created but confirmation email could not be sent. Please contact support.' }, { status: 500 })
    }

    logger.info({ email }, 'register.success')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ error: String(err) }, 'register.failed')
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
