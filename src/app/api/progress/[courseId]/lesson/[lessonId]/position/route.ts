import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> }
) {
  try {
    const { courseId, lessonId } = await params
    const { positionSeconds } = await req.json()
    if (typeof positionSeconds !== 'number' || !Number.isFinite(positionSeconds) || positionSeconds < 0) {
      return NextResponse.json({ error: 'Invalid positionSeconds' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await supabase.from('video_playback_progress').upsert({
      user_id: user.id,
      course_id: Number(courseId),
      lesson_id: Number(lessonId),
      position_seconds: Math.floor(positionSeconds),
    }, { onConflict: 'user_id,lesson_id' })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
