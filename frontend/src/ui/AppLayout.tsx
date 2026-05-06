import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../lib/auth'

export default function AppLayout() {
  const auth = useAuth()
  const location = useLocation()

  if (!auth.token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/app/dashboard" className="text-sm font-semibold tracking-tight">
              RAAS Learning
            </Link>
            <Link className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-100" to="/app/learning-paths">
              Learning Paths
            </Link>
            <Link className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-100" to="/app/admin/courses">
              Admin
            </Link>
          </div>
          <button
            className="rounded-md border bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => auth.setToken(null)}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
