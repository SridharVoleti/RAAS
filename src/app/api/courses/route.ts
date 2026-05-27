import { NextResponse } from 'next/server'
import { getCourses, getCoursesCount } from '@/lib/getCourses'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0)
    const pathId = searchParams.get('pathId') ? parseInt(searchParams.get('pathId')!, 10) : undefined

    // Fetch courses with pagination
    const courses = await getCourses({
      limit,
      offset,
      pathId,
      published: true,
    })

    // Fetch total count for pagination metadata
    const total = await getCoursesCount({ pathId, published: true })

    // Prepare response with pagination metadata
    const response = NextResponse.json({
      items: courses,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    })

    // Add cache headers: 24 hours
    response.headers.set('Cache-Control', 'public, max-age=86400')
    response.headers.set('CDN-Cache-Control', 'max-age=86400')

    return response
  } catch (err) {
    console.error('[GET /api/courses] Error:', err)
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 })
  }
}
