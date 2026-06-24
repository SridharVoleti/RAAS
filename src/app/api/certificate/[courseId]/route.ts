import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
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

    const adminSupabase = await createAdminClient()

    // Check enrollment type
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('is_active, exam_only')
      .eq('user_id', user.id)
      .eq('course_id', Number(courseId))
      .maybeSingle()

    if (!enrollment?.is_active) {
      return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
    }

    // Check passed exam session (required for all certificate paths)
    const { data: passedSession } = await supabase
      .from('exam_sessions')
      .select('id, score, submitted_at')
      .eq('user_id', user.id)
      .eq('course_id', Number(courseId))
      .eq('status', 'submitted')
      .eq('passed', true)
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (enrollment.exam_only) {
      // Exam-only path: just need a passing exam session
      if (!passedSession) {
        return NextResponse.json(
          { error: 'You must pass the certification exam to receive a certificate' },
          { status: 403 }
        )
      }
    } else {
      // Full-course path: need 100% lesson completion + passing exam
      const { data: courseProgress } = await supabase
        .from('vw_my_courses')
        .select('title_en, title_te, progress_pct, emoji, activated_at')
        .eq('user_id', user.id)
        .eq('id', Number(courseId))
        .single()

      if (!courseProgress) {
        return NextResponse.json({ error: 'Not enrolled in this course' }, { status: 403 })
      }

      if (courseProgress.progress_pct < 100) {
        return NextResponse.json(
          { error: 'Course not yet completed', progress: courseProgress.progress_pct },
          { status: 403 }
        )
      }

      // Check if course has an exam requirement
      const { data: course } = await adminSupabase
        .from('courses')
        .select('has_exam')
        .eq('id', Number(courseId))
        .single()

      if (course?.has_exam && !passedSession) {
        return NextResponse.json(
          { error: 'You must pass the certification exam to receive a certificate' },
          { status: 403 }
        )
      }
    }

    // Fetch course info
    const { data: courseInfo } = await adminSupabase
      .from('courses')
      .select('title_en, title_te, emoji')
      .eq('id', Number(courseId))
      .single()

    // Fetch student name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    // Completion date: exam submission date (most meaningful) or latest lesson progress
    let completedAt = passedSession?.submitted_at ?? new Date().toISOString()

    if (!passedSession) {
      const { data: latestProgress } = await supabase
        .from('user_progress')
        .select('completed_at')
        .eq('user_id', user.id)
        .eq('course_id', Number(courseId))
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      completedAt = latestProgress?.completed_at ?? completedAt
    }

    logger.info({ userId: user.id, courseId }, 'certificate.generated')

    return NextResponse.json({
      studentName:   profile?.full_name ?? 'Student',
      courseTitle:   courseInfo?.title_en ?? '',
      courseTitleTe: courseInfo?.title_te ?? null,
      completedAt,
      emoji:         courseInfo?.emoji ?? '📖',
      courseId:      Number(courseId),
      examScore:     passedSession?.score ?? null,
    })
  } catch (err) {
    logger.error({ error: String(err) }, 'certificate.failed')
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 })
  }
}
