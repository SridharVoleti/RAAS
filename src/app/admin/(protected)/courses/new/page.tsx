import CourseForm from '@/components/admin/CourseForm'

export default function NewCoursePage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-brand-gold font-bold text-xl">New Course</h1>
        <p className="text-brand-gold-muted text-sm mt-1">Fill in the details below. You can add lessons after saving.</p>
      </div>
      <CourseForm />
    </div>
  )
}
