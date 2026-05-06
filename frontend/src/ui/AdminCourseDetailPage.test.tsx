import { render, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

import AdminCourseDetailPage from './AdminCourseDetailPage'
import { createTestWrapper } from '../test/render'

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = undefined
})

test('admin course detail page shows lesson video ids', async () => {
  const { wrapper } = createTestWrapper({ token: 'test-token', route: '/app/admin/course/c1' })

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        course: {
          id: 'c1',
          title: 'Course A',
          description: 'Desc',
          price: 0,
          lessons: [
            { id: 'l1', title: 'Lesson 1', youtube_id: 'abc123' },
            { id: 'l2', title: 'Lesson 2', youtube_id: 'def456' },
          ],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  render(
    <Routes>
      <Route path="/app/admin/course/:courseId" element={<AdminCourseDetailPage />} />
    </Routes>,
    { wrapper },
  )

  expect(await screen.findByText('Course A')).toBeInTheDocument()
  expect(screen.getByText(/Lesson 1/i)).toBeInTheDocument()
  expect(screen.getByText(/abc123/i)).toBeInTheDocument()
  expect(screen.getByText(/def456/i)).toBeInTheDocument()
})
