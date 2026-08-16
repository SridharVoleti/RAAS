import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { logger } from '@/lib/logger'
import { isSyntheticEmail } from '@/lib/validation'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()

  const [
    { data: enrollments, error: enrollError },
    { data: courses },
    { data: lessons },
    { data: progressRows },
  ] = await Promise.all([
    supabase.from('enrollments').select('user_id, course_id, enrolled_at').eq('is_active', true),
    supabase.from('courses').select('id, title_en, title_te, emoji, bg_color'),
    supabase.from('lessons').select('id, course_id'),
    supabase.from('user_progress').select('user_id, course_id'),
  ])

  if (enrollError) {
    logger.error({ error: enrollError.message }, 'admin.analytics.student-progress.failed')
    return NextResponse.json({ error: enrollError.message }, { status: 500 })
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ students: [] })
  }

  const courseById = new Map((courses ?? []).map(c => [c.id, c]))

  const totalLessonsByCourse = new Map<number, number>()
  for (const l of lessons ?? []) {
    totalLessonsByCourse.set(l.course_id, (totalLessonsByCourse.get(l.course_id) ?? 0) + 1)
  }

  const completedByUserCourse = new Map<string, number>()
  for (const p of progressRows ?? []) {
    const key = `${p.user_id}:${p.course_id}`
    completedByUserCourse.set(key, (completedByUserCourse.get(key) ?? 0) + 1)
  }

  const userIds = [...new Set(enrollments.map(e => e.user_id))]

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_initials, student_id')
    .in('id', userIds)

  if (profilesError) {
    logger.error({ error: profilesError.message }, 'admin.analytics.student-progress.profiles.failed')
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  // listUsers fetches up to 1000; matched against enrolled users only.
  const { data: listUsersData, error: listUsersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listUsersError) {
    logger.error({ err: listUsersError }, 'admin.analytics.student-progress.listUsers.failed')
  }
  const authUsers = listUsersData?.users ?? []

  const studentsByUserId = new Map<string, {
    id: string
    full_name: string
    avatar_initials: string
    student_id: number | null
    email: string
    courses: {
      course_id: number
      title_en: string
      title_te: string
      emoji: string
      bg_color: string
      completed_lessons: number
      total_lessons: number
      progress_pct: number
      enrolled_at: string
    }[]
  }>()

  for (const e of enrollments) {
    const course = courseById.get(e.course_id)
    if (!course) continue

    if (!studentsByUserId.has(e.user_id)) {
      const profile = profiles?.find(p => p.id === e.user_id)
      const authUser = authUsers.find(u => u.id === e.user_id)
      const email = authUser?.email && !isSyntheticEmail(authUser.email) ? authUser.email : ''
      studentsByUserId.set(e.user_id, {
        id: e.user_id,
        full_name: profile?.full_name ?? '(unknown)',
        avatar_initials: profile?.avatar_initials ?? '?',
        student_id: profile?.student_id ?? null,
        email,
        courses: [],
      })
    }

    const totalLessons = totalLessonsByCourse.get(e.course_id) ?? 0
    const completedLessons = completedByUserCourse.get(`${e.user_id}:${e.course_id}`) ?? 0

    studentsByUserId.get(e.user_id)!.courses.push({
      course_id: e.course_id,
      title_en: course.title_en,
      title_te: course.title_te,
      emoji: course.emoji,
      bg_color: course.bg_color,
      completed_lessons: completedLessons,
      total_lessons: totalLessons,
      progress_pct: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
      enrolled_at: e.enrolled_at,
    })
  }

  const students = [...studentsByUserId.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))

  logger.info({ count: students.length }, 'admin.analytics.student-progress.listed')
  return NextResponse.json({ students })
}
