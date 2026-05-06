import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
      <header className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="text-sm font-semibold tracking-tight">RAAS Learning</div>
          <div className="flex items-center gap-2">
            <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" to="/blog">
              Blog
            </Link>
            <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" to="/login">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">Learn with structured paths. Earn certificates.</h1>
          <p className="mt-2 text-slate-600">
            Browse courses and learning paths. Purchase via QR payment and start learning with strict progress gating.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-xl border bg-white p-5">
            <div className="text-sm font-semibold">Courses</div>
            <div className="mt-1 text-sm text-slate-600">Explore individual courses and outlines.</div>
            <div className="mt-3">
              <Link className="text-sm font-medium text-blue-700 hover:underline" to="/login">
                View as student
              </Link>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <div className="text-sm font-semibold">Learning Paths</div>
            <div className="mt-1 text-sm text-slate-600">Get a curated set of courses with a guided order.</div>
            <div className="mt-3">
              <Link className="text-sm font-medium text-blue-700 hover:underline" to="/login">
                Sign in to purchase
              </Link>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <div className="text-sm font-semibold">Certificates</div>
            <div className="mt-1 text-sm text-slate-600">Complete 100% of content to unlock completion PDFs.</div>
          </div>
          <div className="rounded-xl border bg-white p-5">
            <div className="text-sm font-semibold">Blog</div>
            <div className="mt-1 text-sm text-slate-600">Read book notes and published articles.</div>
            <div className="mt-3">
              <Link className="text-sm font-medium text-blue-700 hover:underline" to="/blog">
                Open blog
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
