import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, CreateLessonSchema } from '@/lib/validation'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', Number(id))
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const parsed = await parseBody(req, CreateLessonSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const { id } = await params
  const supabase = await createAdminClient()

  // Auto-assign order_index if not provided
  if (!body.order_index) {
    const { count } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', Number(id))
    body.order_index = (count ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      course_id:       Number(id),
      section_title:   body.section_title || null,
      title_en:        body.title_en,
      title_te:        body.title_te || null,
      youtube_video_id: body.youtube_video_id,
      duration:        body.duration || null,
      order_index:     Number(body.order_index),
      is_preview:      body.is_preview ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
