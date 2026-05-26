import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// One-time endpoint to promote a user to admin.
// Requires ADMIN_SETUP_SECRET env var to be set.
// Usage: POST /api/admin/bootstrap
//   Authorization: Bearer <ADMIN_SETUP_SECRET>
//   Body: { "email": "you@example.com" }

export async function POST(req: Request) {
  const secret = process.env.ADMIN_SETUP_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'ADMIN_SETUP_SECRET is not configured' }, { status: 500 })
  }

  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { email } = await req.json()
  if (!email?.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Look up the user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 })

  const target = users.find(u => u.email?.toLowerCase() === email.trim().toLowerCase())
  if (!target) {
    return NextResponse.json(
      { error: `No user found with email ${email}. Register first, then call this endpoint.` },
      { status: 404 }
    )
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_admin: true })
    .eq('id', target.id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true, message: `${email} is now an admin.` })
}
