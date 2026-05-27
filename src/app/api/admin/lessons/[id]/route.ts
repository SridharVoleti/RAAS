import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, UpdateLessonSchema } from '@/lib/validation'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const parsed = await parseBody(req, UpdateLessonSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const { id } = await params
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('lessons')
    .update({
      section_title:    body.section_title ?? null,
      title_en:         body.title_en,
      title_te:         body.title_te ?? null,
      youtube_video_id: body.youtube_video_id,
      duration:         body.duration ?? null,
      order_index:      body.order_index,
      is_preview:       body.is_preview ?? false,
    })
    .eq('id', Number(id))
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  const { error } = await supabase.from('lessons').delete().eq('id', Number(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
