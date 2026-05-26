import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// Strip country code, keep last 10 digits (for Fast2SMS India numbers)
function stripCountryCode(mobile: string): string {
  return mobile.replace(/^\+\d{1,3}/, '').replace(/\D/g, '').slice(-10)
}

async function sendSmsFast2SMS(mobile: string, otp: string): Promise<void> {
  const apiKey = process.env.FAST2SMS_API_KEY
  if (!apiKey) {
    // Development fallback — log to server console
    console.log(`[DEV] Mobile OTP for ${mobile}: ${otp}`)
    return
  }

  const number = stripCountryCode(mobile)
  const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      route: 'q',
      message: `Your Krishnamargam verification OTP is ${otp}. Valid for 10 minutes. Do not share this code.`,
      language: 'english',
      flash: 0,
      numbers: number,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`SMS send failed: ${body}`)
  }
}

export async function POST(req: Request) {
  try {
    const { mobile } = await req.json()
    if (!mobile) {
      return NextResponse.json({ error: 'Mobile number required' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Rate limit: no more than 1 OTP per mobile per 60 seconds
    const { data: recent } = await supabase
      .from('otp_tokens')
      .select('created_at')
      .eq('mobile', mobile)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recent) {
      const secondsAgo = (Date.now() - new Date(recent.created_at).getTime()) / 1000
      if (secondsAgo < 60) {
        return NextResponse.json(
          { error: 'Please wait before requesting another OTP', retryAfter: Math.ceil(60 - secondsAgo) },
          { status: 429 }
        )
      }
    }

    const otp = generateOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await supabase.from('otp_tokens').insert({ mobile, token: otp, expires_at: expiresAt })
    await sendSmsFast2SMS(mobile, otp)

    return NextResponse.json({ sent: true })
  } catch (err) {
    console.error('send-mobile-otp error:', err)
    return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 })
  }
}
