import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { sendWelcomeEmail } from '@/lib/email'
import { mobileToSyntheticEmail } from '@/lib/validation'

export async function POST(req: Request) {
  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { email, password, fullName, fathersName, address, city, mobile, avatarInitials, referralSource } = body

  if (!password) {
    return NextResponse.json({ error: 'Password is required' }, { status: 400 })
  }

  const hasEmail  = typeof email  === 'string' && email.trim().length > 0
  const hasMobile = typeof mobile === 'string' && mobile.trim().length > 0

  if (!hasEmail && !hasMobile) {
    return NextResponse.json({ error: 'Email or mobile number is required' }, { status: 400 })
  }

  // For mobile-only accounts: synthesise a stable auth email.
  // The domain mobile.srikrishnamargam.in is never used as a real mailbox.
  const authEmail     = hasEmail ? email.trim() : mobileToSyntheticEmail('', mobile.trim())
  const isMobileUser  = !hasEmail

  try {
    const supabase = await createAdminClient()

    const { data, error } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name:       fullName       ?? '',
        fathers_name:    fathersName    ?? '',
        address:         address        ?? '',
        city:            city           ?? '',
        mobile:          mobile         ?? '',
        avatar_initials: avatarInitials ?? '',
        referral_source: referralSource ?? '',
        is_mobile_user:  isMobileUser,
        email_verified:  isMobileUser ? true : false,
      },
    })

    if (error) {
      logger.error({ error: error.message }, 'register.createUser.failed')
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.info({ authEmail, isMobileUser, userId: data.user.id }, 'register.success')

    // Welcome email only for real email accounts (synthetic addresses have no inbox)
    if (hasEmail) await sendWelcomeEmail(data.user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ error: String(err) }, 'register.failed')
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
