import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { parseBody, VerifyOtpSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  const parsed = await parseBody(req, VerifyOtpSchema)
  if (!parsed.success) return parsed.response
  const { mobile, otp } = parsed.data

  try {
    const supabase = await createAdminClient()

    const MAX_ATTEMPTS = 5

    // Find the most recent valid, unused OTP for this mobile
    const { data: token } = await supabase
      .from('otp_tokens')
      .select('id, token, attempts')
      .eq('mobile', mobile)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!token) {
      logger.warn({ mobile }, 'otp.verify.expired')
      return NextResponse.json({ error: 'OTP expired or not found. Please request a new one.' }, { status: 400 })
    }

    // Lock token after too many wrong attempts
    if (token.attempts >= MAX_ATTEMPTS) {
      await supabase.from('otp_tokens').update({ used: true }).eq('id', token.id)
      logger.warn({ mobile }, 'otp.verify.locked')
      return NextResponse.json({ error: 'Too many incorrect attempts. Please request a new OTP.' }, { status: 429 })
    }

    if (token.token !== otp.trim()) {
      await supabase.from('otp_tokens').update({ attempts: token.attempts + 1 }).eq('id', token.id)
      const remaining = MAX_ATTEMPTS - token.attempts - 1
      logger.warn({ mobile, remaining }, 'otp.verify.wrong')
      return NextResponse.json(
        { error: `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` },
        { status: 400 }
      )
    }

    await supabase.from('otp_tokens').update({ used: true }).eq('id', token.id)

    await supabase
      .from('profiles')
      .update({ mobile_verified: true })
      .eq('mobile', mobile)

    logger.info({ mobile }, 'otp.verified')
    return NextResponse.json({ verified: true })
  } catch (err) {
    logger.error({ mobile, error: String(err) }, 'otp.verify.failed')
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
