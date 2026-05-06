import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import HomePage from './HomePage'

test('home page renders marketing headline', () => {
  const qc = new QueryClient()

  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  expect(screen.getByText(/learn with structured paths/i)).toBeInTheDocument()
})
