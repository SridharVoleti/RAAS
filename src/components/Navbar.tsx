'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { Profile } from '@/types'
import EmailVerificationBanner from '@/components/EmailVerificationBanner'
import { isSyntheticEmail } from '@/lib/validation'

export default function Navbar() {
  const { lang, setLang, t } = useLang()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [showVerifyBanner, setShowVerifyBanner] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function loadProfile(userId: string) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      setProfile(data)
    }

    function checkVerification(user: { email?: string; user_metadata?: Record<string, unknown> } | null) {
      if (!user) { setShowVerifyBanner(false); return }
      const isSynthetic = isSyntheticEmail(user.email ?? '')
      const isVerified  = user.user_metadata?.email_verified !== false
      setShowVerifyBanner(!isSynthetic && !isVerified)
    }

    // Fast optimistic read from cookie storage (no network round-trip)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { loadProfile(session.user.id); checkVerification(session.user) }
    })

    // Authoritative listener — handles INITIAL_SESSION, SIGNED_IN, SIGNED_OUT,
    // TOKEN_REFRESHED, and any concurrent sign-in from another tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id)
        checkVerification(session.user)
      } else {
        setProfile(null)
        setShowVerifyBanner(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchQuery.trim()) {
      router.push(`/explore?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  return (
    <div className="sticky top-0 z-50">
      {showVerifyBanner && <EmailVerificationBanner />}
    <nav className="bg-brand-bg border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <span className="text-3xl leading-none text-brand-gold">ॐ</span>
            <div className="flex flex-col leading-tight">
              <span className="text-brand-gold font-bold text-lg tracking-wide group-hover:text-yellow-300 transition-colors">
                {t.nav.platform}
              </span>
              <span className="text-brand-gold-muted text-xs">{t.nav.tagline}</span>
            </div>
          </Link>

          {/* Right: Nav links */}
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative hidden sm:flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-brand-gold-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder={t.hero.searchPlaceholder}
                className="pl-9 pr-3 py-1.5 bg-brand-card border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-all w-36 focus:w-48"
              />
            </div>

            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'te' : 'en')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-brand-border text-brand-gold-muted hover:border-brand-gold hover:text-brand-gold transition-colors text-sm font-medium"
            >
              <span className={lang === 'en' ? 'text-brand-gold' : 'text-brand-gold-muted'}>EN</span>
              <span className="text-brand-border">|</span>
              <span className={lang === 'te' ? 'text-brand-gold' : 'text-brand-gold-muted'}>తె</span>
            </button>

            <Link
              href="/explore"
              className="text-brand-gold-secondary hover:text-brand-gold transition-colors text-sm font-medium"
            >
              {t.nav.explore}
            </Link>

            {profile ? (
              <div className="flex items-center gap-3">
                <Link href="/my-courses" className="text-brand-gold-secondary hover:text-brand-gold transition-colors text-sm font-medium">
                  {t.nav.myCourses}
                </Link>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-xs font-bold">
                    {profile.avatar_initials}
                  </div>
                  <span className="text-brand-body text-sm hidden sm:block">
                    {profile.full_name.split(' ')[0]}
                  </span>
                </div>
                <button
                  onClick={handleSignOut}
                  className="px-3 py-1.5 text-sm text-brand-gold-muted hover:text-brand-error border border-brand-border hover:border-brand-error rounded-lg transition-colors"
                >
                  {t.nav.signOut}
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
              >
                {t.nav.signIn}
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
    </div>
  )
}
