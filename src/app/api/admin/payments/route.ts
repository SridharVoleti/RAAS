import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()

  const { data: payments, error } = await supabase
    .from('payment_logs')
    .select('*')
    .eq('status', 'created')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!payments || payments.length === 0) return NextResponse.json([])

  // Enrich with profile names and course titles
  const userIds = [...new Set(payments.map(p => p.user_id))]
  const courseIds = [...new Set(payments.map(p => p.course_id))]

  const [{ data: profiles }, { data: courses }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('id', userIds),
    supabase.from('courses').select('id, title_en').in('id', courseIds),
  ])

  const result = payments.map(p => ({
    ...p,
    student_name: profiles?.find(pr => pr.id === p.user_id)?.full_name ?? '—',
    course_title: courses?.find(c => c.id === p.course_id)?.title_en ?? '—',
  }))

  return NextResponse.json(result)
}
