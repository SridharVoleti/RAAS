import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()

  const now = new Date()
  const yearStart  = `${now.getFullYear()}-01-01T00:00:00.000Z`
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`

  const [
    { count: totalCourses },
    { count: totalStudents },
    { data: revenueRows },
    { count: pendingCount },
    { count: registeredStudents },
    { count: studentsThisYear },
    { count: studentsThisMonth },
  ] = await Promise.all([
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('payment_logs').select('amount').eq('status', 'paid'),
    supabase.from('payment_logs').select('*', { count: 'exact', head: true }).eq('status', 'created'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false).gte('created_at', yearStart),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false).gte('created_at', monthStart),
  ])

  const totalRevenue = revenueRows?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0

  return NextResponse.json({
    totalCourses:       totalCourses       ?? 0,
    totalStudents:      totalStudents      ?? 0,
    totalRevenue,
    pendingPayments:    pendingCount       ?? 0,
    registeredStudents: registeredStudents ?? 0,
    studentsThisYear:   studentsThisYear   ?? 0,
    studentsThisMonth:  studentsThisMonth  ?? 0,
  })
}
