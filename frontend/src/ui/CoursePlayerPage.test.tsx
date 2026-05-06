import { render, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

import CoursePlayerPage from './CoursePlayerPage'
import { createTestWrapper } from '../test/render'

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = undefined
})

test('course player shows progress bar and lesson list', async () => {
  const { wrapper } = createTestWrapper({ token: 'test-token', route: '/app/course/c1' })

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        course: { id: 'c1', title: 'Course A', description: 'Desc' },
        enrollment_status: 'active',
        lessons: [
          { id: 'l1', title: 'Lesson 1', enabled: true, completed: false },
          { id: 'l2', title: 'Lesson 2', enabled: false, completed: false },
        ],
        progress_summary: { total_lessons: 2, completed_lessons: 0, percent: 0 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  render(
    <Routes>
      <Route path="/app/course/:courseId" element={<CoursePlayerPage />} />
    </Routes>,
    { wrapper },
  )

  expect(await screen.findByText('Course A')).toBeInTheDocument()
  expect(screen.getByText(/Lesson 1/i)).toBeInTheDocument()
  expect(screen.getByText(/Lesson 2/i)).toBeInTheDocument()
  expect(document.body.textContent).toMatch(/0\s*\/\s*2/)
})
