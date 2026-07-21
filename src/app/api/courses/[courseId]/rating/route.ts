import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCertificate } from '@/lib/certificate'
import { parseBody, CourseRatingSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

/** The logged-in student's own rating for this course, if any. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { courseId } = await params
  const courseIdNum = Number(courseId)

  const { data } = await supabase
    .from('course_ratings')
    .select('rating')
    .eq('user_id', user.id)
    .eq('course_id', courseIdNum)
    .maybeSingle()

  return NextResponse.json({ rating: data?.rating ?? null })
}

/** Submit or update the logged-in student's 5-star rating — only once they've earned the certificate. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, CourseRatingSchema)
  if (!parsed.success) return parsed.response

  const { courseId } = await params
  const courseIdNum = Number(courseId)

  const cert = await getCertificate(courseIdNum)
  if (!cert.ok) {
    return NextResponse.json({ error: 'You can rate a course only after completing it' }, { status: 403 })
  }

  const { error } = await supabase
    .from('course_ratings')
    .upsert(
      { user_id: user.id, course_id: courseIdNum, rating: parsed.data.rating, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,course_id' }
    )

  if (error) {
    logger.error({ error: error.message, courseId: courseIdNum }, 'course_rating.upsert_failed')
    return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
