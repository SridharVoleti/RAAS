import { createClient, createAdminClient } from '@/lib/supabase/server'

// Must match CHAPTER_QUIZ_PASS_SCORE in WatchClient.tsx (chapter quizzes are 5 questions)
const CHAPTER_QUIZ_PASS_SCORE = 3

export interface CertificateData {
  studentName: string
  courseTitle: string
  courseTitleTe: string | null
  completedAt: string
  emoji: string
  courseId: number
  examScore: number | null
}

export type CertificateResult =
  | { ok: true; data: CertificateData }
  | { ok: false; status: number; error: string; progress?: number }

/**
 * Certificate eligibility — two independent tracks:
 *  - Regular course track: every lesson ticked (progress 100%) AND every
 *    chapter quiz passed (score ≥ 3/5). No final exam required.
 *  - Prior-learning (exam-only) track: pass the full final exam.
 */
export async function getCertificate(courseId: number): Promise<CertificateResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, status: 401, error: 'Unauthorized' }

  const adminSupabase = createAdminClient()

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('is_active, exam_only')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()

  if (!enrollment?.is_active) {
    return { ok: false, status: 403, error: 'Not enrolled in this course' }
  }

  // Best passing exam session (completion evidence for the exam-only track)
  const { data: passedSession } = await supabase
    .from('exam_sessions')
    .select('id, score, submitted_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .eq('status', 'submitted')
    .eq('passed', true)
    .order('score', { ascending: false })
    .limit(1)
    .maybeSingle()

  let completedAt: string

  if (enrollment.exam_only) {
    if (!passedSession) {
      return { ok: false, status: 403, error: 'You must pass the certification exam to receive a certificate' }
    }
    completedAt = passedSession.submitted_at ?? new Date().toISOString()
  } else {
    // Regular track: 100% lessons ticked
    const { data: courseProgress } = await supabase
      .from('vw_my_courses')
      .select('progress_pct')
      .eq('user_id', user.id)
      .eq('id', courseId)
      .single()

    if (!courseProgress) {
      return { ok: false, status: 403, error: 'Not enrolled in this course' }
    }
    if (courseProgress.progress_pct < 100) {
      return { ok: false, status: 403, error: 'Course not yet completed', progress: courseProgress.progress_pct }
    }

    // …and every chapter quiz passed (chapters that actually have questions)
    const { data: chapters } = await adminSupabase
      .from('chapters')
      .select('id')
      .eq('course_id', courseId)
    const chapterIds = (chapters ?? []).map(c => c.id)

    let lastQuizAt: string | null = null
    if (chapterIds.length > 0) {
      const { data: questionRows } = await adminSupabase
        .from('exam_questions')
        .select('chapter_id')
        .in('chapter_id', chapterIds)
      const requiredChapterIds = [...new Set((questionRows ?? []).map(q => q.chapter_id))]

      if (requiredChapterIds.length > 0) {
        const { data: passingSubs } = await supabase
          .from('quiz_submissions')
          .select('chapter_id, submitted_at')
          .eq('user_id', user.id)
          .in('chapter_id', requiredChapterIds)
          .gte('score', CHAPTER_QUIZ_PASS_SCORE)

        const passedChapterIds = new Set((passingSubs ?? []).map(s => s.chapter_id))
        const allPassed = requiredChapterIds.every(id => passedChapterIds.has(id))
        if (!allPassed) {
          return { ok: false, status: 403, error: 'You must pass all chapter quizzes to receive a certificate' }
        }
        for (const s of passingSubs ?? []) {
          if (s.submitted_at && (!lastQuizAt || s.submitted_at > lastQuizAt)) lastQuizAt = s.submitted_at
        }
      }
    }

    const { data: latestProgress } = await supabase
      .from('user_progress')
      .select('completed_at')
      .eq('user_id', user.id)
      .eq('course_id', courseId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastLessonAt = latestProgress?.completed_at ?? null
    completedAt =
      [lastLessonAt, lastQuizAt].filter((d): d is string => d !== null).sort().pop()
      ?? new Date().toISOString()
  }

  const { data: courseInfo } = await adminSupabase
    .from('courses')
    .select('title_en, title_te, emoji')
    .eq('id', courseId)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return {
    ok: true,
    data: {
      studentName:   profile?.full_name ?? 'Student',
      courseTitle:   courseInfo?.title_en ?? '',
      courseTitleTe: courseInfo?.title_te ?? null,
      completedAt,
      emoji:         courseInfo?.emoji ?? '📖',
      courseId,
      examScore:     passedSession?.score ?? null,
    },
  }
}
