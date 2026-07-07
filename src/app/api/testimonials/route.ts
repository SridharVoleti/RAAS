import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, TestimonialSubmitSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

// Student Voices: enrolled students submit a testimonial; it stays hidden
// (is_published = false) until an admin publishes it on the home page.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = await parseBody(req, TestimonialSubmitSchema)
  if (!parsed.success) return parsed.response
  const { reviewerName, message, rating, courseId } = parsed.data

  // Only students with at least one active enrollment may submit
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json(
      { error: 'Please enroll in a course before sharing your experience' },
      { status: 403 }
    )
  }

  const adminSupabase = createAdminClient()
  const { data: testimonial, error } = await adminSupabase
    .from('testimonials')
    .insert({
      user_id:       user.id,
      reviewer_name: reviewerName,
      content_en:    message,
      rating,
      course_id:     courseId ?? null,
      is_published:  false,
    })
    .select()
    .single()

  if (error) {
    logger.error({ error: error.message, userId: user.id }, 'testimonials.submit.failed')
    return NextResponse.json({ error: 'Failed to submit your voice' }, { status: 500 })
  }

  logger.info({ userId: user.id, testimonialId: testimonial.id }, 'testimonials.submitted')
  return NextResponse.json({ testimonial }, { status: 201 })
}

// The caller's own submissions, so the form can show pending/published status
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('testimonials')
    .select('id, reviewer_name, content_en, rating, course_id, is_published, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error({ error: error.message, userId: user.id }, 'testimonials.own.list.failed')
    return NextResponse.json({ error: 'Failed to load your submissions' }, { status: 500 })
  }

  return NextResponse.json({ testimonials: data ?? [] })
}
