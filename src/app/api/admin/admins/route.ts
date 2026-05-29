import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { logger } from '@/lib/logger'

// GET — list all admins
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_initials, created_at')
    .eq('is_admin', true)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with email from Supabase auth
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const admins = (profiles ?? []).map(p => ({
    ...p,
    email: users.find(u => u.id === p.id)?.email ?? '',
  }))

  return NextResponse.json(admins)
}

// POST — promote a user to admin by email
export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  let email: string
  try {
    const body = await req.json()
    email = (body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })

  const supabase = await createAdminClient()

  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

  const target = users.find(u => u.email?.toLowerCase() === email)
  if (!target) {
    return NextResponse.json({ error: `No user found with email ${email}` }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', target.id)
    .single()

  if (profile?.is_admin) {
    return NextResponse.json({ error: 'User is already an admin' }, { status: 409 })
  }

  const { error } = await supabase.from('profiles').update({ is_admin: true }).eq('id', target.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logger.info({ promotedBy: admin.id, promotedUser: target.id, email }, 'admin.promoted')
  return NextResponse.json({ success: true, message: `${email} is now an admin.` })
}
