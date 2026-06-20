import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import CourseForm from '@/components/admin/CourseForm'
import ChapterManager from '@/components/admin/ChapterManager'
import LessonManager from '@/components/admin/LessonManager'
import type { Course } from '@/types'

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('id', Number(id))
    .single()

  if (error || !data) notFound()

  const course = data as Course

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-brand-gold font-bold text-xl">
          {course.emoji} {course.title_en}
        </h1>
        <p className="text-brand-gold-muted text-sm mt-1">Edit course details and manage lessons.</p>
      </div>

      <CourseForm course={course} />

      <ChapterManager courseId={course.id} />

      <LessonManager courseId={course.id} />
    </div>
  )
}
