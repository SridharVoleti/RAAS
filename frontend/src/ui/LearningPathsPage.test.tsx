import { fireEvent, render, screen, within } from '@testing-library/react'

import LearningPathsPage from './LearningPathsPage'
import { createTestWrapper } from '../test/render'

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = undefined
})

test('learning paths page shows courses for expanded path', async () => {
  const { wrapper } = createTestWrapper({ token: 'test-token', route: '/app/learning-paths' })

  globalThis.fetch = async (input) => {
    const url = String(input)

    if (url.includes('/api/learner/learning-paths')) {
      return new Response(
        JSON.stringify({
          learning_paths: [
            { id: 'lp1', title: 'Path 1', description: 'Desc', price: 0, course_count: 2 },
            { id: 'lp2', title: 'Path 2', description: 'Desc', price: 0, course_count: 0 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (url.includes('/api/learner/public/learning-path/lp1/outline')) {
      return new Response(
        JSON.stringify({
          learning_path: { id: 'lp1', title: 'Path 1', description: 'Desc' },
          courses: [
            { id: 'c1', title: 'Course A', description: 'A', lessons: [{ id: 'l1', title: 'L1' }] },
            { id: 'c2', title: 'Course B', description: 'B', lessons: [] },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ error: 'not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  render(<LearningPathsPage />, { wrapper })

  const pathTitle = await screen.findByText('Path 1')
  expect(pathTitle).toBeInTheDocument()

  const card = pathTitle.closest('div.rounded-2xl')
  expect(card).not.toBeNull()
  fireEvent.click(within(card as HTMLElement).getByRole('button', { name: /view courses/i }))

  expect(await screen.findByText('Course A')).toBeInTheDocument()
  expect(screen.getByText('Course B')).toBeInTheDocument()
})
