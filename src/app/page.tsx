import { Suspense } from 'react'
import { getCachedCourses, getCachedStats, getCachedTestimonials, getCachedWidgets } from '@/lib/homeData'
import HomeContent from '@/components/HomeContent'

export default async function HomePage() {
  const [courses, stats, testimonials, widgets] = await Promise.all([
    getCachedCourses(),
    getCachedStats(),
    getCachedTestimonials(),
    getCachedWidgets(),
  ])

  return (
    <Suspense>
      <HomeContent courses={courses} stats={stats} testimonials={testimonials} widgets={widgets} />
    </Suspense>
  )
}
