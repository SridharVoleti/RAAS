import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { csrfCheck } from '@/lib/csrf'
import { isLive } from '@/lib/launch'

export async function middleware(request: NextRequest) {
  // CSRF: reject cross-origin mutation requests to /api routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rejected = csrfCheck(
      request.nextUrl.pathname,
      request.method,
      request.headers.get('origin')
    )
    if (rejected) return rejected
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Pre-launch gate: until go-live, only home/register/auth flows and admins
  // (for QA) may reach the rest of the site. /admin/* keeps its own gate below.
  if (!isLive() && !pathname.startsWith('/admin')) {
    const allowedPaths = ['/', '/register', '/login', '/onboarding', '/auth/callback']
    const isAllowed = allowedPaths.includes(pathname) || pathname.startsWith('/api/auth/')

    let isAdmin = false
    if (user) {
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      isAdmin = !!data?.is_admin
    }

    if (!isAdmin && !isAllowed) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie as Parameters<typeof redirectResponse.cookies.set>[2])
      })
      return redirectResponse
    }
  }

  // Protected routes
  const protectedRoutes = ['/home', '/my-courses', '/watch', '/payment', '/profile', '/certificate']
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('returnTo', pathname)
    const redirectResponse = NextResponse.redirect(url)
    // Forward any cookie updates (e.g. stale-token clears) from Supabase to the redirect response
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie as Parameters<typeof redirectResponse.cookies.set>[2])
    })
    return redirectResponse
  }

  // Admin routes
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/login'
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie as Parameters<typeof redirectResponse.cookies.set>[2])
      })
      return redirectResponse
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
