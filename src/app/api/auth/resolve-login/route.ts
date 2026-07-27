import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import {
  looksLikeMobile,
  normalizeMobileDigits,
  toFullMobileDigits,
  MOBILE_AUTH_DOMAIN,
} from '@/lib/validation'

/**
 * A raw mobile string can be typed in more than one equivalent form
 * (with/without the country code, with/without formatting) depending on
 * the device and how the number was entered at registration. Expand it to
 * every digit form we're willing to treat as the same account, so lookup
 * doesn't depend on which form the user happens to type.
 */
function candidateDigits(raw: string): string[] {
  const asTyped = normalizeMobileDigits(raw)
  const indiaAssumed = toFullMobileDigits('+91', raw)
  return asTyped === indiaAssumed ? [asTyped] : [asTyped, indiaAssumed]
}

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

  // Mobile login — find the correct Supabase auth email. The same account may
  // have been registered from a different device/browser than the one logging
  // in now, so try every digit form we'd accept as equivalent.
  const loginCandidates = candidateDigits(username)
  const candidateEmails = new Set(loginCandidates.map(d => `${d}@${MOBILE_AUTH_DOMAIN}`))

  try {
    const supabase = await createAdminClient()
    // `page` must be passed explicitly — supabase-js sends page='' when omitted,
    // which the Auth admin API 500s on ("Database error finding users").
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) {
      logger.error({ error: error.message }, 'resolve-login.listUsers.failed')
      return NextResponse.json({ error: 'Could not resolve login' }, { status: 500 })
    }

    // 1. Mobile-only user: their Supabase auth email IS the synthetic email
    const mobileOnlyUser = users.find(u => candidateEmails.has((u.email ?? '').toLowerCase()))
    if (mobileOnlyUser) {
      logger.info({ userId: mobileOnlyUser.id }, 'resolve-login.mobile-only')
      return NextResponse.json({ authEmail: (mobileOnlyUser.email ?? '').toLowerCase() })
    }

    // 2. Email+mobile user: real email in auth, mobile stored in user_metadata
    const emailMobileUser = users.find(u => {
      const meta = u.user_metadata?.mobile as string | undefined
      if (!meta) return false
      const metaCandidates = candidateDigits(meta)
      return metaCandidates.some(d => loginCandidates.includes(d))
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
