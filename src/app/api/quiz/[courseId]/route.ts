import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params
  const courseIdNum = Number(courseId)

  // Verify active enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('is_active')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .maybeSingle()

  if (!enrollment?.is_active) {
    return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })
  }

  // Return questions without correct_option
  const adminSupabase = await createAdminClient()
  const { data, error } = await adminSupabase
    .from('quiz_questions')
    .select('id, course_id, question_en, question_te, option_a_en, option_a_te, option_b_en, option_b_te, option_c_en, option_c_te, option_d_en, option_d_te, order_index')
    .eq('course_id', courseIdNum)
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
