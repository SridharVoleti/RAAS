import { createClient, createAdminClient } from '@/lib/supabase/server'

// A user can access a course's Q&A if they're actively enrolled, or if they're an admin
// (admins can open any course to moderate discussions without enrolling first).
export async function canAccessCourseQA(userId: string, courseId: number): Promise<boolean> {
  const supabase = await createClient()
  const [{ data: enrollment }, { data: profile }] = await Promise.all([
    supabase.from('enrollments').select('is_active').eq('user_id', userId).eq('course_id', courseId).maybeSingle(),
    supabase.from('profiles').select('is_admin').eq('id', userId).single(),
  ])
  return !!enrollment?.is_active || !!profile?.is_admin
}

type WithUserId = { user_id: string }
type WithAuthor<T> = Omit<T, 'user_id'> & { author_name: string; author_initials: string; is_own: boolean }

// Batch-attaches author display info to a set of rows that each carry a user_id,
// avoiding one profile lookup per row.
export async function attachAuthors<T extends WithUserId>(
  adminSupabase: ReturnType<typeof createAdminClient>,
  currentUserId: string,
  rows: T[]
): Promise<WithAuthor<T>[]> {
  const ids = [...new Set(rows.map(r => r.user_id))]
  const { data: profiles } = ids.length > 0
    ? await adminSupabase.from('profiles').select('id, full_name, avatar_initials').in('id', ids)
    : { data: [] as { id: string; full_name: string; avatar_initials: string }[] }

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return rows.map(({ user_id, ...rest }) => {
    const profile = profileMap.get(user_id)
    return {
      ...rest,
      author_name: profile?.full_name || 'Student',
      author_initials: profile?.avatar_initials || '?',
      is_own: user_id === currentUserId,
    } as WithAuthor<T>
  })
}
