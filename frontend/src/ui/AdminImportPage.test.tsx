import { render, screen } from '@testing-library/react'

import AdminImportPage from './AdminImportPage'
import { createTestWrapper } from '../test/render'

test('admin import page renders upload UI', () => {
  const { wrapper } = createTestWrapper({ token: 'test-token', route: '/app/admin/import' })

  render(<AdminImportPage />, { wrapper })

  expect(screen.getByText(/import courses/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument()
})
