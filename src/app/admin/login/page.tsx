'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function AdminLoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError('Invalid credentials.'); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Authentication failed.'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        await supabase.auth.signOut()
        setError('Access denied. This account does not have admin privileges.')
        return
      }

      router.push('/admin')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#0d0800] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-brand-gold text-5xl font-serif">ॐ</span>
          <h1 className="text-brand-gold font-bold text-xl mt-2">Krishnamargam</h1>
          <p className="text-brand-gold-muted text-xs mt-1">Admin Panel</p>
        </div>

        <div className="bg-brand-card border border-brand-border rounded-2xl p-8">
          <h2 className="text-brand-gold font-bold text-lg mb-6">Sign In</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-brand-error/10 border border-brand-error/30 text-brand-error text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                placeholder="admin@krishnamargam.in"
              />
            </div>
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 pr-10 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gold-muted hover:text-brand-gold">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4">
          <a href="/" className="text-brand-gold-muted text-xs hover:text-brand-gold transition-colors">
            ← Back to site
          </a>
        </p>
      </div>
    </div>
  )
}
