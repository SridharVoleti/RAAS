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

    // Find the most recent valid, unused OTP for this mobile
    const { data: token } = await supabase
      .from('otp_tokens')
      .select('id, token')
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

    if (token.token !== otp.trim()) {
      logger.warn({ mobile }, 'otp.verify.wrong')
      return NextResponse.json({ error: 'Incorrect OTP. Please try again.' }, { status: 400 })
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
