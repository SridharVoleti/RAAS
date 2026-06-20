import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, CreateChapterSchema } from '@/lib/validation'

export async function GET(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { searchParams } = new URL(req.url)
  const courseId = Number(searchParams.get('courseId'))
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('chapters')
    .select('*')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { searchParams } = new URL(req.url)
  const courseId = Number(searchParams.get('courseId'))
  if (!courseId) return NextResponse.json({ error: 'courseId required' }, { status: 400 })

  const parsed = await parseBody(req, CreateChapterSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const supabase = await createAdminClient()

  if (body.order_index === undefined) {
    const { count } = await supabase
      .from('chapters')
      .select('*', { count: 'exact', head: true })
      .eq('course_id', courseId)
    body.order_index = (count ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('chapters')
    .insert({ course_id: courseId, ...body })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
