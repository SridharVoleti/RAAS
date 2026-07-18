import { createAdminClient } from '@/lib/supabase/server'

// Must match CHAPTER_QUIZ_PASS_SCORE in WatchClient.tsx / certificate.ts
const CHAPTER_QUIZ_PASS_SCORE = 3

export interface AwardedStudent {
  userId: string
  studentName: string
  studentId: string | null
  track: 'course' | 'exam'
  completedAt: string
  examScore: number | null
}

/**
 * All students who have earned a certificate for a course, computed in bulk
 * with the same rules as getCertificate():
 *  - regular track: every lesson ticked + every chapter quiz passed
 *  - exam-only track: passed the final exam
 * Admin-side only (service role) — callers must have verified the admin user.
 */
export async function getAwardedStudents(courseId: number): Promise<AwardedStudent[]> {
  const supabase = createAdminClient()

  const [{ data: lessons }, { data: chapters }, { data: enrollments }, { data: examSessions }, { data: progress }] =
    await Promise.all([
      supabase.from('lessons').select('id').eq('course_id', courseId),
      supabase.from('chapters').select('id').eq('course_id', courseId),
      supabase.from('enrollments').select('user_id, exam_only').eq('course_id', courseId).eq('is_active', true),
      supabase.from('exam_sessions').select('user_id, score, submitted_at')
        .eq('course_id', courseId).eq('status', 'submitted').eq('passed', true),
      supabase.from('user_progress').select('user_id, completed_at').eq('course_id', courseId),
    ])

  const totalLessons = (lessons ?? []).length
  const chapterIds = (chapters ?? []).map(c => c.id)

  // Chapters that actually have quiz questions are the required ones
  let requiredChapterIds: number[] = []
  let passingSubs: { user_id: string; chapter_id: number; submitted_at: string | null }[] = []
  if (chapterIds.length > 0) {
    const { data: questionRows } = await supabase
      .from('exam_questions')
      .select('chapter_id')
      .in('chapter_id', chapterIds)
    requiredChapterIds = [...new Set((questionRows ?? []).map(q => q.chapter_id))]

    if (requiredChapterIds.length > 0) {
      const { data: subs } = await supabase
        .from('quiz_submissions')
        .select('user_id, chapter_id, submitted_at')
        .in('chapter_id', requiredChapterIds)
        .gte('score', CHAPTER_QUIZ_PASS_SCORE)
      passingSubs = subs ?? []
    }
  }

  // Index the raw rows per user
  const bestExamByUser = new Map<string, { score: number; submitted_at: string | null }>()
  for (const s of examSessions ?? []) {
    const best = bestExamByUser.get(s.user_id)
    if (!best || s.score > best.score) bestExamByUser.set(s.user_id, s)
  }

  const progressByUser = new Map<string, { count: number; lastAt: string | null }>()
  for (const p of progress ?? []) {
    const entry = progressByUser.get(p.user_id) ?? { count: 0, lastAt: null }
    entry.count++
    if (p.completed_at && (!entry.lastAt || p.completed_at > entry.lastAt)) entry.lastAt = p.completed_at
    progressByUser.set(p.user_id, entry)
  }

  const chapterPassesByUser = new Map<string, { chapterIds: Set<number>; lastAt: string | null }>()
  for (const s of passingSubs) {
    const entry = chapterPassesByUser.get(s.user_id) ?? { chapterIds: new Set<number>(), lastAt: null }
    entry.chapterIds.add(s.chapter_id)
    if (s.submitted_at && (!entry.lastAt || s.submitted_at > entry.lastAt)) entry.lastAt = s.submitted_at
    chapterPassesByUser.set(s.user_id, entry)
  }

  // Evaluate every active enrollment
  const awarded: Omit<AwardedStudent, 'studentName' | 'studentId'>[] = []
  for (const e of enrollments ?? []) {
    const exam = bestExamByUser.get(e.user_id)

    if (e.exam_only) {
      if (!exam) continue
      awarded.push({
        userId: e.user_id,
        track: 'exam',
        completedAt: exam.submitted_at ?? '',
        examScore: exam.score,
      })
      continue
    }

    const prog = progressByUser.get(e.user_id)
    if (totalLessons === 0 || !prog || prog.count < totalLessons) continue

    const passes = chapterPassesByUser.get(e.user_id)
    const allChaptersPassed = requiredChapterIds.every(id => passes?.chapterIds.has(id))
    if (!allChaptersPassed) continue

    const completedAt =
      [prog.lastAt, passes?.lastAt ?? null].filter((d): d is string => d !== null).sort().pop() ?? ''
    awarded.push({ userId: e.user_id, track: 'course', completedAt, examScore: exam?.score ?? null })
  }

  if (awarded.length === 0) return []

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, student_id')
    .in('id', awarded.map(a => a.userId))
  const profileById = new Map((profiles ?? []).map(p => [p.id, p]))

  return awarded
    .map(a => ({
      ...a,
      studentName: profileById.get(a.userId)?.full_name ?? 'Student',
      studentId:   profileById.get(a.userId)?.student_id ?? null,
    }))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
}
