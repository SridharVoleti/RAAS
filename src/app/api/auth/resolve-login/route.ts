import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  looksLikeMobile,
  loginMobileToSyntheticEmail,
  normalizeLoginMobile,
  normalizeMobileDigits,
} from '@/lib/validation'

/**
 * POST /api/auth/resolve-login
 * Body:    { username: string }   — email address OR mobile number
 * Returns: { authEmail: string }  — the Supabase auth email to use for signInWithPassword
 *
 * For email input: returns the email unchanged.
 * For mobile input: searches auth.users for
 *   1. a mobile-only account (synthetic email)
 *   2. an email+mobile account (real email, mobile stored in user_metadata)
 */
export async function POST(req: Request) {
  let username: string
  try {
    const body = await req.json()
    username = (body.username ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }

  // Email login — return as-is, let Supabase handle "user not found"
  if (!looksLikeMobile(username)) {
    return NextResponse.json({ authEmail: username.toLowerCase() })
  }

  // Mobile login — find the correct Supabase auth email
  const syntheticEmail   = loginMobileToSyntheticEmail(username)
  const normalizedDigits = normalizeLoginMobile(username)

  try {
    const supabase = await createAdminClient()
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (error) {
      logger.error({ error: error.message }, 'resolve-login.listUsers.failed')
      return NextResponse.json({ error: 'Could not resolve login' }, { status: 500 })
    }

    // 1. Mobile-only user: their Supabase auth email IS the synthetic email
    const mobileOnlyUser = users.find(u => u.email?.toLowerCase() === syntheticEmail)
    if (mobileOnlyUser) {
      logger.info({ userId: mobileOnlyUser.id }, 'resolve-login.mobile-only')
      return NextResponse.json({ authEmail: syntheticEmail })
    }

    // 2. Email+mobile user: real email in auth, mobile stored in user_metadata
    const emailMobileUser = users.find(u => {
      const meta = u.user_metadata?.mobile as string | undefined
      if (!meta) return false
      return normalizeMobileDigits(meta) === normalizedDigits
    })
    if (emailMobileUser?.email) {
      logger.info({ userId: emailMobileUser.id }, 'resolve-login.email-mobile')
      return NextResponse.json({ authEmail: emailMobileUser.email })
    }

    logger.warn({ username }, 'resolve-login.not-found')
    return NextResponse.json(
      { error: 'No account found with this mobile number' },
      { status: 404 }
    )
  } catch (err) {
    logger.error({ err, username }, 'resolve-login.failed')
    return NextResponse.json({ error: 'Could not resolve login' }, { status: 500 })
  }
}
