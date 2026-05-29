import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { logger } from '@/lib/logger'

// DELETE — demote an admin back to a regular user
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { userId } = await params

  // Prevent self-demotion
  if (userId === admin.id) {
    return NextResponse.json({ error: 'You cannot demote yourself.' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, full_name')
    .eq('id', userId)
    .single()

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (!profile.is_admin) return NextResponse.json({ error: 'User is not an admin' }, { status: 400 })

  const { error } = await supabase.from('profiles').update({ is_admin: false }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  logger.info({ demotedBy: admin.id, demotedUser: userId }, 'admin.demoted')
  return NextResponse.json({ success: true })
}
