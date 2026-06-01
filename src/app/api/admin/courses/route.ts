import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, CreateCourseSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('courses')
    .select('*, lessons(id)')
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const courses = data.map(c => ({
    ...c,
    lesson_count: c.lessons?.length ?? 0,
    lessons: undefined,
  }))

  return NextResponse.json(courses)
}

export async function POST(req: Request) {
  logger.info('POST /api/admin/courses — request received')
  const admin = await getAdminUser()
  if (!admin) {
    logger.warn('POST /api/admin/courses — forbidden: not an admin')
    return forbidden()
  }
  logger.debug({ adminId: admin.id }, 'POST /api/admin/courses — admin verified')

  const parsed = await parseBody(req, CreateCourseSchema)
  if (!parsed.success) {
    logger.warn('POST /api/admin/courses — validation failed')
    return parsed.response
  }
  const body = parsed.data
  logger.info({ slug: body.slug, title_en: body.title_en, is_published: body.is_published }, 'POST /api/admin/courses — inserting course')

  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .insert({
      path_id:        body.path_id,
      slug:           body.slug,
      emoji:          body.emoji ?? '📖',
      bg_color:       body.bg_color ?? '#1a0f00',
      title_en:       body.title_en,
      title_te:       body.title_te,
      description_en: body.description_en,
      description_te: body.description_te,
      instructor_en:  body.instructor_en,
      instructor_te:  body.instructor_te,
      category:       body.category,
      level:          body.level,
      badge:          body.badge ?? null,
      duration:       body.duration ?? '4 weeks',
      is_free:        body.is_free ?? false,
      price:          body.is_free ? 0 : Number(body.price ?? 0),
      has_quiz:       body.has_quiz ?? false,
      order_index:    Number(body.order_index ?? 0),
      is_published:   body.is_published ?? false,
    })
    .select()
    .single()

  if (error) {
    logger.error({ err: error }, 'POST /api/admin/courses — Supabase insert failed')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  logger.info({ courseId: data.id, slug: data.slug }, 'POST /api/admin/courses — course created successfully')
  revalidatePath('/explore')
  revalidatePath('/')
  return NextResponse.json(data, { status: 201 })
}
