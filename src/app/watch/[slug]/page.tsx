import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import WatchClient from '@/components/WatchClient'
import type { Course, Lesson, QuizQuestion_Public, QuizSubmission } from '@/types'

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

  const [{ data: course }, { data: enrollment }] = await Promise.all([
    adminSupabase
      .from('courses')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single(),
    supabase
      .from('enrollments')
      .select('id, is_active')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!course) redirect('/explore')

  // Check enrollment status
  if (!enrollment) {
    return <NotEnrolledScreen course={course as Course} status="not_enrolled" />
  }
  if (!enrollment.is_active) {
    return <NotEnrolledScreen course={course as Course} status="pending" />
  }

  // Fetch lessons + progress in parallel
  const [{ data: lessons }, { data: progressRows }] = await Promise.all([
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
  ])

  const allLessons = (lessons || []) as Lesson[]
  const lessonIds = allLessons.map(l => l.id)

  // Fetch all quiz questions and user's submissions for this course's lessons
  const [{ data: quizQuestions }, { data: quizSubmissions }] = lessonIds.length > 0
    ? await Promise.all([
        adminSupabase
          .from('quiz_questions')
          .select('id, lesson_id, question_en, question_te, option_a_en, option_a_te, option_b_en, option_b_te, option_c_en, option_c_te, option_d_en, option_d_te, order_index')
          .in('lesson_id', lessonIds)
          .order('order_index'),
        supabase
          .from('quiz_submissions')
          .select('*')
          .eq('user_id', user.id)
          .in('lesson_id', lessonIds),
      ])
    : [{ data: [] }, { data: [] }]

  const completedLessonIds = (progressRows || []).map(p => p.lesson_id as number)
  const initialIdx = Math.max(
    0,
    Math.min(parseInt(lessonParam || '0', 10), allLessons.length - 1)
  )

  return (
    <WatchClient
      course={course as Course}
      lessons={allLessons}
      completedLessonIds={completedLessonIds}
      initialLessonIndex={initialIdx}
      quizQuestions={(quizQuestions ?? []) as QuizQuestion_Public[]}
      quizSubmissions={(quizSubmissions ?? []) as QuizSubmission[]}
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
