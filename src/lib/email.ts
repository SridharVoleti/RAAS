import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM_EMAIL ?? 'Krishnamargam <noreply@krishnamargam.com>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://krishnamargam.com'

const DEFAULT_SUBJECT = "You're enrolled in {{course_en}} — Krishnamargam"
const DEFAULT_BODY = `Namaskar {{name}},

You are now enrolled in {{course_en}} ({{course_te}}).

Your spiritual journey begins now. May this path bring you clarity, wisdom, and peace.

Click below to start learning: {{link}}`

function applyVariables(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (out, [key, val]) => out.replaceAll(`{{${key}}}`, val),
    text
  )
}

function wrapInBrandedHtml(messageBody: string, subject: string): string {
  const bodyHtml = messageBody
    .split('\n')
    .map(line => line.trim() === '' ? '<br>' : `<p style="color:#f5e6c8;font-size:15px;line-height:1.7;margin:0 0 4px 0;">${line}</p>`)
    .join('\n')

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
              <h1 style="color:#f0b429;font-size:22px;font-weight:700;margin:0 0 24px 0;">${subject}</h1>
              ${bodyHtml}
              <div style="text-align:center;margin-top:32px;">
                <a href="${APP_URL}/my-courses"
                   style="display:inline-block;background:#f0b429;color:#1a0f00;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;">
                  Start Learning →
                </a>
              </div>
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

export async function sendEnrollmentEmail(userId: string, courseId: number): Promise<void> {
  try {
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

    if (!user?.email || !profile || !course) return

    const vars = {
      name:      profile.full_name || 'Student',
      course_en: course.title_en,
      course_te: course.title_te,
      link:      `${APP_URL}/my-courses`,
    }

    const subject = applyVariables(template?.subject ?? DEFAULT_SUBJECT, vars)
    const body    = applyVariables(template?.body    ?? DEFAULT_BODY,    vars)

    await resend.emails.send({
      from: FROM,
      to:   [user.email],
      subject,
      html: wrapInBrandedHtml(body, subject),
    })
  } catch (err) {
    // Non-critical — log but never break the enrollment flow
    console.error('[email] sendEnrollmentEmail failed:', err)
  }
}
