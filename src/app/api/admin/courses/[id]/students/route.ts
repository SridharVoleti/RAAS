import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { logger } from '@/lib/logger'
import { isSyntheticEmail } from '@/lib/validation'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const courseId = Number(id)
  const supabase = await createAdminClient()

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('id, title_en, title_te, slug')
    .eq('id', courseId)
    .single()

  if (courseError || !course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select('user_id, enrolled_at, is_active, activated_at')
    .eq('course_id', courseId)
    .order('enrolled_at', { ascending: false })

  if (enrollError) {
    logger.error({ error: enrollError.message, courseId }, 'admin.course-students.list.failed')
    return NextResponse.json({ error: enrollError.message }, { status: 500 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ course, items: [] })
  }

  const userIds = enrollments.map(e => e.user_id)

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_initials, student_id, username, mobile, isd_code, city, country')
    .in('id', userIds)

  if (profilesError) {
    logger.error({ error: profilesError.message, courseId }, 'admin.course-students.profiles.failed')
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  // listUsers fetches up to 1000; matched against this course's enrollees only.
  const { data: listUsersData, error: listUsersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listUsersError) {
    logger.error({ err: listUsersError }, 'admin.course-students.listUsers.failed')
  }
  const authUsers = listUsersData?.users ?? []

  const items = enrollments.map(e => {
    const profile = profiles?.find(p => p.id === e.user_id)
    const authUser = authUsers.find(u => u.id === e.user_id)
    const email = authUser?.email && !isSyntheticEmail(authUser.email) ? authUser.email : ''
    return {
      id:              e.user_id,
      full_name:       profile?.full_name ?? '(unknown)',
      avatar_initials: profile?.avatar_initials ?? '?',
      student_id:      profile?.student_id ?? null,
      username:        profile?.username ?? null,
      mobile:          profile?.mobile ?? null,
      isd_code:        profile?.isd_code ?? '',
      city:            profile?.city ?? null,
      country:         profile?.country ?? '',
      email,
      enrolled_at:     e.enrolled_at,
      is_active:       e.is_active,
      activated_at:    e.activated_at,
    }
  })

  logger.info({ courseId, count: items.length }, 'admin.course-students.listed')
  return NextResponse.json({ course, items })
}
