import { getCachedCourses, getCachedStats, getCachedTestimonials } from '@/lib/homeData'
import HomeContent from '@/components/HomeContent'

export default async function HomePage() {
  const [courses, stats, testimonials] = await Promise.all([
    getCachedCourses(),
    getCachedStats(),
    getCachedTestimonials(),
  ])

  return <HomeContent courses={courses} stats={stats} testimonials={testimonials} />
}
