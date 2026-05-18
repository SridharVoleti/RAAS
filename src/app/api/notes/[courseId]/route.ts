import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('user_notes')
      .select('content')
      .eq('user_id', user.id)
      .eq('course_id', Number(courseId))
      .single()

    return NextResponse.json({ content: data?.content || '' })
  } catch {
    return NextResponse.json({ content: '' })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params
    const { content } = await req.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await supabase.from('user_notes').upsert({
      user_id: user.id,
      course_id: Number(courseId),
      content,
    }, { onConflict: 'user_id,course_id' })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
