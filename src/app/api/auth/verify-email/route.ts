import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const token  = searchParams.get('token')

  if (!userId || !token) {
    return NextResponse.redirect(new URL('/?verified=invalid', req.url))
  }

  const admin = await createAdminClient()
  const { data: { user }, error } = await admin.auth.admin.getUserById(userId)

  if (error || !user) {
    return NextResponse.redirect(new URL('/?verified=invalid', req.url))
  }

  if (user.user_metadata?.email_verification_token !== token) {
    logger.warn({ userId }, 'verify-email.invalid_token')
    return NextResponse.redirect(new URL('/?verified=invalid', req.url))
  }

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...user.user_metadata,
      email_verified: true,
      email_verification_token: null,
    },
  })

  logger.info({ userId }, 'verify-email.success')
  return NextResponse.redirect(new URL('/?verified=true', req.url))
}
