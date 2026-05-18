import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()

  const [
    { count: totalCourses },
    { count: totalStudents },
    { data: revenueRows },
    { count: pendingCount },
  ] = await Promise.all([
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('payment_logs').select('amount').eq('status', 'paid'),
    supabase.from('payment_logs').select('*', { count: 'exact', head: true }).eq('status', 'created'),
  ])

  const totalRevenue = revenueRows?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0

  return NextResponse.json({
    totalCourses: totalCourses ?? 0,
    totalStudents: totalStudents ?? 0,
    totalRevenue,
    pendingPayments: pendingCount ?? 0,
  })
}
