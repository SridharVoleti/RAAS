import Link from 'next/link'
import { BookOpen, Users, IndianRupee, Clock, AlertCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'

export default async function AdminDashboard() {
  const supabase = await createAdminClient()

  const [
    { count: totalCourses },
    { count: activeUsers },
    { data: revenueRows },
    { count: pendingCount },
    { data: pendingPayments },
  ] = await Promise.all([
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('payment_logs').select('amount').eq('status', 'paid'),
    supabase.from('payment_logs').select('*', { count: 'exact', head: true }).eq('status', 'created'),
    supabase.from('payment_logs')
      .select('id, amount, created_at, course_id, user_id')
      .eq('status', 'created')
      .order('created_at', { ascending: true })
      .limit(5),
  ])

  const totalRevenue = revenueRows?.reduce((sum, r) => sum + Number(r.amount), 0) ?? 0

  // Fetch profiles + courses for pending payments
  let enrichedPending: Array<{
    id: number; amount: number; created_at: string;
    studentName: string; courseTitle: string
  }> = []

  if (pendingPayments && pendingPayments.length > 0) {
    const userIds = [...new Set(pendingPayments.map(p => p.user_id))]
    const courseIds = [...new Set(pendingPayments.map(p => p.course_id))]

    const [{ data: profiles }, { data: courses }] = await Promise.all([
      supabase.from('profiles').select('id, full_name').in('id', userIds),
      supabase.from('courses').select('id, title_en').in('id', courseIds),
    ])

    enrichedPending = pendingPayments.map(p => ({
      id: p.id,
      amount: p.amount,
      created_at: p.created_at,
      studentName: profiles?.find(pr => pr.id === p.user_id)?.full_name ?? '—',
      courseTitle: courses?.find(c => c.id === p.course_id)?.title_en ?? '—',
    }))
  }

  const STATS = [
    { label: 'Published Courses', value: totalCourses ?? 0, icon: BookOpen, color: 'text-brand-gold' },
    { label: 'Active Users', value: activeUsers ?? 0, icon: Users, color: 'text-brand-success' },
    { label: 'Revenue (₹)', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: IndianRupee, color: 'text-blue-400' },
    { label: 'Pending Payments', value: pendingCount ?? 0, icon: Clock, color: 'text-brand-error' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-brand-gold font-bold text-xl">Dashboard</h1>

      {/* Pending alert */}
      {(pendingCount ?? 0) > 0 && (
        <div className="flex items-center gap-3 p-4 bg-brand-error/10 border border-brand-error/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-brand-error flex-shrink-0" />
          <p className="text-brand-error text-sm flex-1">
            <span className="font-semibold">{pendingCount} payment{(pendingCount ?? 0) > 1 ? 's' : ''}</span> waiting for confirmation.
          </p>
          <Link href="/admin/payments"
            className="px-3 py-1 bg-brand-error text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors">
            Review
          </Link>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-brand-card border border-brand-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-brand-gold-muted text-xs font-medium">{s.label}</span>
                <Icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          )
        })}
      </div>

      {/* Recent pending payments */}
      {enrichedPending.length > 0 && (
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border">
            <h2 className="text-brand-gold font-semibold text-sm">Recent Pending Payments</h2>
            <Link href="/admin/payments" className="text-brand-gold-muted text-xs hover:text-brand-gold transition-colors">
              View all →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-brand-gold-muted text-xs uppercase border-b border-brand-border bg-brand-bg">
                <th className="text-left px-5 py-3 font-medium">Student</th>
                <th className="text-left px-5 py-3 font-medium">Course</th>
                <th className="text-right px-5 py-3 font-medium">Amount</th>
                <th className="text-right px-5 py-3 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {enrichedPending.map((p, i) => (
                <tr key={p.id} className={`border-b border-brand-border last:border-0 ${i % 2 === 0 ? '' : 'bg-brand-bg/40'}`}>
                  <td className="px-5 py-3 text-brand-body">{p.studentName}</td>
                  <td className="px-5 py-3 text-brand-body">{p.courseTitle}</td>
                  <td className="px-5 py-3 text-right text-brand-gold font-medium">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-right text-brand-gold-muted text-xs">
                    {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <Link href="/admin/courses/new"
          className="flex items-center gap-3 p-4 bg-brand-card border border-brand-border rounded-xl hover:border-brand-gold transition-colors group">
          <BookOpen className="w-5 h-5 text-brand-gold-muted group-hover:text-brand-gold transition-colors" />
          <div>
            <div className="text-brand-body text-sm font-medium">Add New Course</div>
            <div className="text-brand-gold-muted text-xs">Create and publish a course</div>
          </div>
        </Link>
        <Link href="/admin/payments"
          className="flex items-center gap-3 p-4 bg-brand-card border border-brand-border rounded-xl hover:border-brand-gold transition-colors group">
          <Clock className="w-5 h-5 text-brand-gold-muted group-hover:text-brand-gold transition-colors" />
          <div>
            <div className="text-brand-body text-sm font-medium">Confirm Payments</div>
            <div className="text-brand-gold-muted text-xs">Approve pending enrollments</div>
          </div>
        </Link>
      </div>
    </div>
  )
}
