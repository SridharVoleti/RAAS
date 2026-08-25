import { Suspense } from 'react'
import { headers } from 'next/headers'
import { getCachedCourses, getCachedPaths, getCachedStats, getCachedTestimonials, getCachedWidgets } from '@/lib/homeData'
import { getLaunchAt, isLive } from '@/lib/launch'
import HomeContent from '@/components/HomeContent'
import MobileHomeContent from '@/components/MobileHomeContent'

function isMobileUserAgent(userAgent: string) {
  return /Mobi|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
}

export default async function HomePage() {
  const [courses, paths, stats, testimonials, widgets] = await Promise.all([
    getCachedCourses(),
    getCachedPaths(),
    getCachedStats(),
    getCachedTestimonials(),
    getCachedWidgets(),
  ])

  const requestHeaders = await headers()
  const mobile = isMobileUserAgent(requestHeaders.get('user-agent') ?? '')
  const sharedProps = {
    courses,
    paths,
    stats,
    testimonials,
    widgets,
    isLive: isLive(),
    launchAt: getLaunchAt().toISOString(),
  }

  return (
    <Suspense>
      {mobile ? <MobileHomeContent {...sharedProps} /> : <HomeContent {...sharedProps} />}
    </Suspense>
  )
}
