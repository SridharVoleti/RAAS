import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Handles email confirmation redirects (PKCE flow)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('returnTo') ?? searchParams.get('next') ?? '/'
  const next = rawNext.startsWith('/') ? rawNext : '/'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('mobile_verified, mobile')
            .eq('id', user.id)
            .maybeSingle()

          if (!profile?.mobile_verified && profile?.mobile) {
            return NextResponse.redirect(
              `${origin}/verify-mobile?returnTo=${encodeURIComponent(next)}`
            )
          }
        }
      } catch {
        // Profile check failed — let the user through
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}
