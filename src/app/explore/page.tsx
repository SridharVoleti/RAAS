import { Suspense } from 'react'
import ExploreContent from './ExploreContent'

export default function ExplorePage() {
  return (
    <Suspense>
      <ExploreContent />
    </Suspense>
  )
}
