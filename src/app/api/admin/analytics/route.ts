import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()

  // Per-course enrollment + revenue + completion stats
  const [
    { data: courses },
    { data: enrollments },
    { data: payments },
    { data: progressRows },
  ] = await Promise.all([
    supabase.from('courses').select('id, title_en, emoji, bg_color, is_published').eq('is_published', true),
    supabase.from('enrollments').select('course_id, enrolled_at, is_active').eq('is_active', true),
    supabase.from('payment_logs').select('course_id, amount, created_at').eq('status', 'paid'),
    supabase.from('user_progress').select('course_id, completed_at'),
  ])

  const courseStats = (courses ?? []).map(course => {
    const courseEnrollments = (enrollments ?? []).filter(e => e.course_id === course.id)
    const courseRevenue = (payments ?? [])
      .filter(p => p.course_id === course.id)
      .reduce((sum, p) => sum + Number(p.amount), 0)

    return {
      id: course.id,
      title: course.title_en,
      emoji: course.emoji,
      bgColor: course.bg_color,
      enrollments: courseEnrollments.length,
      revenue: courseRevenue,
    }
  }).sort((a, b) => b.enrollments - a.enrollments)

  // Monthly enrollment trend — last 6 months
  const now = new Date()
  const months: { label: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
    const count = (enrollments ?? []).filter(e => e.enrolled_at >= start && e.enrolled_at <= end).length
    months.push({ label, count })
  }

  // Total lesson completions per course (engagement proxy)
  const completionsBycourse = (courses ?? []).map(course => ({
    id: course.id,
    completions: (progressRows ?? []).filter(p => p.course_id === course.id).length,
  }))

  return NextResponse.json({
    courseStats,
    monthlyTrend: months,
    completionsBycourse,
    totals: {
      courses: (courses ?? []).length,
      enrollments: (enrollments ?? []).length,
      revenue: (payments ?? []).reduce((s, p) => s + Number(p.amount), 0),
      lessonCompletions: (progressRows ?? []).length,
    },
  })
}
