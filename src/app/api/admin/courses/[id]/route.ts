import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, UpdateCourseSchema } from '@/lib/validation'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const parsed = await parseBody(req, UpdateCourseSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const { id } = await params
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .update({
      path_id:        body.path_id,
      slug:           body.slug,
      emoji:          body.emoji,
      bg_color:       body.bg_color,
      title_en:       body.title_en,
      title_te:       body.title_te,
      description_en: body.description_en,
      description_te: body.description_te,
      instructor_en:  body.instructor_en,
      instructor_te:  body.instructor_te,
      category:       body.category,
      level:          body.level,
      badge:          body.badge ?? null,
      duration:       body.duration,
      is_free:        body.is_free,
      price:          body.is_free ? 0 : Number(body.price ?? 0),
      has_quiz:       body.has_quiz,
      is_published:   body.is_published,
      order_index:    body.order_index !== undefined ? Number(body.order_index) : undefined,
    })
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/explore')
  revalidatePath('/')
  return NextResponse.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const supabase = await createAdminClient()

  // Block deletion if enrollments exist
  const { count } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', Number(id))

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Cannot delete a course with existing enrollments.' },
      { status: 400 }
    )
  }

  const { error } = await supabase.from('courses').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/explore')
  revalidatePath('/')
  return NextResponse.json({ success: true })
}
