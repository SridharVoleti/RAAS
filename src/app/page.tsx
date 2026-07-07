import { Suspense } from 'react'
import { getCachedCourses, getCachedPaths, getCachedStats, getCachedTestimonials, getCachedWidgets } from '@/lib/homeData'
import HomeContent from '@/components/HomeContent'

export default async function HomePage() {
  const [courses, paths, stats, testimonials, widgets] = await Promise.all([
    getCachedCourses(),
    getCachedPaths(),
    getCachedStats(),
    getCachedTestimonials(),
    getCachedWidgets(),
  ])

  return (
    <Suspense>
      <HomeContent courses={courses} paths={paths} stats={stats} testimonials={testimonials} widgets={widgets} />
    </Suspense>
  )
}
