import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

import { AuthProvider } from '../lib/auth'

export function createTestWrapper(opts?: { route?: string; token?: string | null }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  if (opts?.token !== undefined) {
    if (opts.token) {
      localStorage.setItem('raas_token', opts.token)
    } else {
      localStorage.removeItem('raas_token')
    }
  }

  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[opts?.route ?? '/']}>{children}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    ),
  }
}
