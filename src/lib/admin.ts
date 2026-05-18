import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('is_admin, full_name, avatar_initials')
    .eq('id', user.id)
    .single()

  if (!data?.is_admin) return null
  return { id: user.id, email: user.email!, full_name: data.full_name, avatar_initials: data.avatar_initials }
}

export function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
