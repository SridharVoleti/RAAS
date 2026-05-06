import { render, screen } from '@testing-library/react'

import DashboardPage from './DashboardPage'
import { createTestWrapper } from '../test/render'

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = undefined
})

test('dashboard renders purchased learning path courses', async () => {
  const { wrapper } = createTestWrapper({ token: 'test-token' })

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        user: { id: 'u1', email: 's@t.com', role: 'student' },
        learning_paths: [
          {
            id: 'lp1',
            title: 'Path 1',
            description: 'Desc',
            courses: [
              { id: 'c1', title: 'Course A', description: 'A' },
              { id: 'c2', title: 'Course B', description: 'B' },
            ],
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  render(<DashboardPage />, { wrapper })

  expect(await screen.findByText('Path 1')).toBeInTheDocument()
  expect(screen.getByText('Course A')).toBeInTheDocument()
  expect(screen.getByText('Course B')).toBeInTheDocument()
})

test('dashboard hides learning paths for admin users', async () => {
  const { wrapper } = createTestWrapper({ token: 'test-token' })

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        user: { id: 'u1', email: 'a@t.com', role: 'admin' },
        learning_paths: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )

  render(<DashboardPage />, { wrapper })

  expect(await screen.findByText(/admin console/i)).toBeInTheDocument()
  expect(screen.queryByText(/your learning paths/i)).not.toBeInTheDocument()
})
