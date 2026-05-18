import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_initials, created_at, is_admin')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!profiles || profiles.length === 0) return NextResponse.json([])

  // Get enrollment counts per user
  const userIds = profiles.map(p => p.id)
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('user_id, course_id, is_active')
    .in('user_id', userIds)
    .eq('is_active', true)

  // Get auth emails via admin API
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers({ perPage: 1000 })

  const result = profiles.map(p => {
    const userEnrollments = enrollments?.filter(e => e.user_id === p.id) ?? []
    const authUser = authUsers.find(u => u.id === p.id)
    return {
      ...p,
      email: authUser?.email ?? '',
      enrolled_courses: userEnrollments.length,
    }
  })

  return NextResponse.json(result)
}
