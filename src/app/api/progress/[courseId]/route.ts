import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const { courseId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data } = await supabase
      .from('user_progress')
      .select('lesson_id, completed_at')
      .eq('user_id', user.id)
      .eq('course_id', Number(courseId))

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
