import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEnrollmentEmail } from '@/lib/email'
import { parseBody, EnrollFreeSchema } from '@/lib/validation'

export async function POST(req: Request) {
  const parsed = await parseBody(req, EnrollFreeSchema)
  if (!parsed.success) return parsed.response
  const { courseId } = parsed.data

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Verify course is free
    const { data: course } = await supabase
      .from('courses')
      .select('is_free, price')
      .eq('id', courseId)
      .single()

    if (!course || (!course.is_free && course.price > 0)) {
      return NextResponse.json({ error: 'Course is not free' }, { status: 400 })
    }

    // Enroll
    const { error } = await supabase.from('enrollments').upsert({
      user_id: user.id,
      course_id: courseId,
      is_active: true,
      activated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id' })

    if (error) throw error

    await sendEnrollmentEmail(user.id, courseId)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Enrollment failed' }, { status: 500 })
  }
}
