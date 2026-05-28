import { NextResponse } from 'next/server'

// Routes exempt from CSRF origin checking (they have their own auth mechanisms)
const CSRF_EXEMPT = ['/api/payment/webhook', '/api/admin/bootstrap']

export function csrfCheck(pathname: string, method: string, origin: string | null): NextResponse | null {
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null
  if (CSRF_EXEMPT.some(exempt => pathname.startsWith(exempt))) return null
  if (!origin) return null  // no Origin = server-to-server = not a CSRF vector

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return null  // env not set → skip check (e.g. during build)

  try {
    if (new URL(origin).origin !== new URL(appUrl).origin) {
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  return null
}
