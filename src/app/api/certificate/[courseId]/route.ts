import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify enrollment and completion via the vw_my_courses view
    const { data: enrollment } = await supabase
      .from('vw_my_courses')
      .select('title_en, title_te, progress_pct, emoji, activated_at')
      .eq('user_id', user.id)
      .eq('id', Number(courseId))
      .single()

    if (!enrollment) {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
    }

    if (enrollment.progress_pct < 100) {
      return NextResponse.json(
        { error: 'Course not yet completed', progress: enrollment.progress_pct },
        { status: 403 }
      )
    }

    // Get the student's name from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // Use the latest lesson completion timestamp as cert date
    const { data: latestProgress } = await supabase
      .from('user_progress')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('course_id', Number(courseId))
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const completedAt = latestProgress?.completed_at ?? new Date().toISOString()

    logger.info({ userId: user.id, courseId }, 'certificate.generated')

    return NextResponse.json({
      studentName: profile?.full_name ?? 'Student',
      courseTitle: enrollment.title_en,
      courseTitleTe: enrollment.title_te ?? null,
      completedAt,
      emoji: enrollment.emoji ?? '📖',
      courseId: Number(courseId),
    })
  } catch (err) {
    logger.error({ error: String(err) }, 'certificate.failed')
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 })
  }
}
