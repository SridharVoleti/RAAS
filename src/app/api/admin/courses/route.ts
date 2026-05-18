import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

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
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const body = await req.json()
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .insert({
      path_id:        body.path_id,
      slug:           body.slug,
      emoji:          body.emoji || '📖',
      bg_color:       body.bg_color || '#1a0f00',
      title_en:       body.title_en,
      title_te:       body.title_te,
      description_en: body.description_en,
      description_te: body.description_te,
      instructor_en:  body.instructor_en,
      instructor_te:  body.instructor_te,
      category:       body.category,
      level:          body.level,
      badge:          body.badge || null,
      duration:       body.duration || '4 weeks',
      is_free:        body.is_free ?? false,
      price:          body.is_free ? 0 : Number(body.price ?? 0),
      has_quiz:       body.has_quiz ?? false,
      order_index:    Number(body.order_index ?? 0),
      is_published:   body.is_published ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
