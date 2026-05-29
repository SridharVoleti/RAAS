import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  let email: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  try {
    const supabase = await createAdminClient()
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (error) {
      logger.error({ error: error.message }, 'check-email.listUsers.failed')
      return NextResponse.json({ error: 'Could not verify email' }, { status: 500 })
    }

    const exists = users.some(u => u.email?.toLowerCase() === email)
    return NextResponse.json({ exists })
  } catch (err) {
    logger.error({ error: String(err) }, 'check-email.failed')
    return NextResponse.json({ error: 'Could not verify email' }, { status: 500 })
  }
}
