import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendVerificationEmail } from '@/lib/email'
import { logger } from '@/lib/logger'
import { isSyntheticEmail } from '@/lib/validation'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isSyntheticEmail(user.email ?? '')) {
    return NextResponse.json({ error: 'Not applicable for mobile accounts' }, { status: 400 })
  }

  if (user.user_metadata?.email_verified === true) {
    return NextResponse.json({ error: 'Email already verified' }, { status: 400 })
  }

  const token = crypto.randomUUID()

  const admin = await createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, email_verification_token: token },
  })

  if (error) {
    logger.error({ error: error.message, userId: user.id }, 'send-verification.update_failed')
    return NextResponse.json({ error: 'Failed to generate verification token' }, { status: 500 })
  }

  await sendVerificationEmail(user.id, token)

  logger.info({ userId: user.id }, 'send-verification.sent')
  return NextResponse.json({ success: true })
}
