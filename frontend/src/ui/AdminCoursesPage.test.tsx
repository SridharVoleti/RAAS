import { render, screen } from '@testing-library/react'

import AdminCoursesPage from './AdminCoursesPage'
import { createTestWrapper } from '../test/render'

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = undefined
})

test('admin courses page renders courses list', async () => {
  const { wrapper } = createTestWrapper({ token: 'test-token', route: '/app/admin/courses' })

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        courses: [
          { id: 'c1', title: 'Course A', description: 'Desc', price: 0, lesson_count: 2 },
          { id: 'c2', title: 'Course B', description: 'Desc', price: 0, lesson_count: 1 },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  render(<AdminCoursesPage />, { wrapper })

  expect(await screen.findByText('Course A')).toBeInTheDocument()
  expect(screen.getByText('Course B')).toBeInTheDocument()
})
