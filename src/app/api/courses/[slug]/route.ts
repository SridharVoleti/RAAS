import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const supabase = await createClient()

    const { data: course, error } = await supabase
      .from('courses')
      .select('*, lessons(*)')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (error) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    // Strip youtube_video_id from lesson data for public API
    if (course.lessons) {
      course.lessons = course.lessons.map((l: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { youtube_video_id, ...rest } = l
        return rest
      })
    }

    return NextResponse.json(course)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch course' }, { status: 500 })
  }
}
