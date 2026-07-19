import { Suspense } from 'react'
import { getCachedCourses, getCachedPaths } from '@/lib/homeData'
import StudentHomeContent from '@/components/StudentHomeContent'

export default async function StudentHomePage() {
  const [courses, paths] = await Promise.all([
    getCachedCourses(),
    getCachedPaths(),
  ])

  return (
    <Suspense>
      <StudentHomeContent courses={courses} paths={paths} />
    </Suspense>
  )
}
