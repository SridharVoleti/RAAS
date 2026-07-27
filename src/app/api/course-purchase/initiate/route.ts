import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseBody, CoursePurchaseInitiateSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

const AMOUNT_USD = 25

export async function POST(req: Request) {
  const parsed = await parseBody(req, CoursePurchaseInitiateSchema)
  if (!parsed.success) return parsed.response
  const { courseId, reference } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient()
  const { data: course } = await adminSupabase
    .from('courses')
    .select('id, is_published')
    .eq('id', courseId)
    .single()

  if (!course || !course.is_published) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 })
  }

  const { error } = await supabase.from('course_purchases').insert({
    user_id:           user.id,
    course_id:         courseId,
    amount_usd:        AMOUNT_USD,
    status:            'pending',
    payment_reference: reference ?? null,
  })
  if (error) {
    logger.error({ err: error, userId: user.id, courseId }, 'course_purchase.initiate.failed')
    return NextResponse.json({ error: 'Could not record purchase' }, { status: 500 })
  }

  // Mark enrollment inactive-pending, same pattern as the domestic payment_logs flow.
  await supabase.from('enrollments').upsert({
    user_id:   user.id,
    course_id: courseId,
    is_active: false,
  }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })

  logger.info({ userId: user.id, courseId }, 'course_purchase.initiated')
  return NextResponse.json({ success: true })
}
