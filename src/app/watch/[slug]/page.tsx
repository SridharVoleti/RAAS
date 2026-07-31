import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import WatchClient from '@/components/WatchClient'
import type { Chapter, Course, Lesson, QuizQuestion_Public, QuizSubmission } from '@/types'

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ lesson?: string }>
}) {
  const { slug } = await params
  const { lesson: lessonParam } = await searchParams

  // Auth check
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnTo=/watch/${slug}`)

  // Fetch course + enrollment in parallel
  const adminSupabase = await createAdminClient()

  const { data: course } = await adminSupabase
    .from('courses')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (!course) redirect('/explore')

  const [{ data: enrollment }, { data: profile }] = await Promise.all([
    supabase
      .from('enrollments')
      .select('id, is_active')
      .eq('user_id', user.id)
      .eq('course_id', course.id)
      .maybeSingle(),
    supabase.from('profiles').select('is_admin').eq('id', user.id).single(),
  ])
  const isAdmin = !!profile?.is_admin

  // Check enrollment status — admins can open any course to moderate discussions
  // without being enrolled themselves.
  if (!isAdmin) {
    if (!enrollment) {
      return <NotEnrolledScreen course={course as Course} status="not_enrolled" />
    }
    if (!enrollment.is_active) {
      return <NotEnrolledScreen course={course as Course} status="pending" />
    }
  }

  // Fetch lessons + progress + chapters + playback positions in parallel
  const [{ data: lessons }, { data: progressRows }, { data: chapters }, { data: playbackRows }] = await Promise.all([
    adminSupabase
      .from('lessons')
      .select('*')
      .eq('course_id', course.id)
      .order('order_index'),
    supabase
      .from('user_progress')
      .select('lesson_id')
      .eq('user_id', user.id)
      .eq('course_id', course.id),
    adminSupabase
      .from('chapters')
      .select('id, title_en, title_te, order_index')
      .eq('course_id', course.id)
      .order('order_index'),
    supabase
      .from('video_playback_progress')
      .select('lesson_id, position_seconds, watched_seconds, updated_at')
      .eq('user_id', user.id)
      .eq('course_id', course.id)
      .order('updated_at', { ascending: false }),
  ])

  const allLessons = (lessons || []) as Lesson[]
  const allChapters = (chapters || []) as Chapter[]
  const lessonIds = allLessons.map(l => l.id)
  const chapterIds = allChapters.map(c => c.id)

  // Fetch lesson quiz questions, chapter quiz question counts, and all submissions in parallel
  const [
    { data: quizQuestions, error: quizQuestionsError },
    { data: quizSubmissions, error: quizSubmissionsError },
    { data: chapterQRows },
  ] = await Promise.all([
    lessonIds.length > 0
      ? adminSupabase
          .from('quiz_questions')
          .select('id, lesson_id, question_en, question_te, option_a_en, option_a_te, option_b_en, option_b_te, option_c_en, option_c_te, option_d_en, option_d_te, order_index')
          .in('lesson_id', lessonIds)
          .order('order_index')
      : Promise.resolve({ data: [], error: null }),
    lessonIds.length > 0
      ? supabase
          .from('quiz_submissions')
          .select('*')
          .eq('user_id', user.id)
          .in('lesson_id', lessonIds)
      : Promise.resolve({ data: [], error: null }),
    chapterIds.length > 0
      ? adminSupabase
          .from('exam_questions')
          .select('chapter_id')
          .in('chapter_id', chapterIds)
      : Promise.resolve({ data: [], error: null }),
  ])

  // Surface failures instead of silently rendering without quizzes (see QUIZ-001)
  if (quizQuestionsError) console.error('[watch] quiz_questions query failed:', quizQuestionsError.message)
  if (quizSubmissionsError) console.error('[watch] quiz_submissions query failed:', quizSubmissionsError.message)

  // Build chapter question count map
  const chapterQuestionCounts: Record<number, number> = {}
  for (const row of (chapterQRows ?? [])) {
    if (row.chapter_id) {
      chapterQuestionCounts[row.chapter_id] = (chapterQuestionCounts[row.chapter_id] ?? 0) + 1
    }
  }

  // Fetch chapter quiz submissions separately (chapter_id filter)
  const { data: chapterSubmissions } = chapterIds.length > 0
    ? await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('user_id', user.id)
        .in('chapter_id', chapterIds)
    : { data: [] }

  const completedLessonIds = (progressRows || []).map(p => p.lesson_id as number)

  const lessonPositions: Record<number, number> = {}
  const lessonWatchedSeconds: Record<number, number> = {}
  for (const row of (playbackRows ?? [])) {
    lessonPositions[row.lesson_id as number] = row.position_seconds as number
    lessonWatchedSeconds[row.lesson_id as number] = (row.watched_seconds as number) ?? 0
  }

  // No explicit ?lesson= param: resume the most recently watched lesson.
  const lastWatchedLessonId = playbackRows?.[0]?.lesson_id as number | undefined
  const lastWatchedIdx = lastWatchedLessonId !== undefined
    ? allLessons.findIndex(l => l.id === lastWatchedLessonId)
    : -1
  const defaultIdx = lastWatchedIdx !== -1 ? lastWatchedIdx : 0
  const initialIdx = lessonParam !== undefined
    ? Math.max(0, Math.min(parseInt(lessonParam, 10), allLessons.length - 1))
    : defaultIdx

  return (
    <WatchClient
      course={course as Course}
      lessons={allLessons}
      completedLessonIds={completedLessonIds}
      initialLessonIndex={initialIdx}
      lessonPositions={lessonPositions}
      lessonWatchedSeconds={lessonWatchedSeconds}
      quizQuestions={(quizQuestions ?? []) as QuizQuestion_Public[]}
      quizSubmissions={(quizSubmissions ?? []) as QuizSubmission[]}
      chapters={allChapters}
      chapterQuestionCounts={chapterQuestionCounts}
      chapterSubmissions={(chapterSubmissions ?? []) as QuizSubmission[]}
      isAdmin={isAdmin}
    />
  )
}

function NotEnrolledScreen({
  course,
  status,
}: {
  course: Course
  status: 'not_enrolled' | 'pending'
}) {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4" style={{ color: '#f0b429' }}>
          {status === 'pending' ? '⏳' : '🔒'}
        </div>
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
          style={{ backgroundColor: course.bg_color }}
        >
          {course.emoji}
        </div>
        <h1 className="text-brand-gold font-bold text-xl mb-2">{course.title_en}</h1>
        <p className="text-brand-gold-muted text-sm mb-6">
          {status === 'pending'
            ? 'Your enrollment is awaiting confirmation. You will receive access once confirmed.'
            : 'Enroll in this course to start watching lessons.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {status === 'not_enrolled' && (
            <Link
              href={`/explore`}
              className="px-6 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
            >
              Explore Courses
            </Link>
          )}
          <Link
            href="/my-courses"
            className="px-6 py-2.5 border border-brand-gold text-brand-gold rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors"
          >
            My Courses
          </Link>
        </div>
      </div>
    </div>
  )
}
