import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

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

  try {
    const supabase = await createAdminClient()

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName ?? '',
        fathers_name: fathersName ?? '',
        username: username ?? '',
        address: address ?? '',
        city: city ?? '',
        mobile: mobile ?? '',
        avatar_initials: avatarInitials ?? '',
        referral_source: referralSource ?? '',
      },
    })

    if (error) {
      logger.error({ error: error.message }, 'register.createUser.failed')
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    logger.info({ email, userId: data.user.id }, 'register.success')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ error: String(err) }, 'register.failed')
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
