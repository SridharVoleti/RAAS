'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Menu, UserRound } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'

export default function MobileNavbar() {
  const { lang, setLang, t } = useLang()
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session))
    return () => subscription.unsubscribe()
  }, [])

  return (
    <nav className="sticky top-0 z-50 border-b border-brand-border bg-brand-bg/95 backdrop-blur md:hidden">
      <div className="flex h-16 items-center gap-3 px-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
          <Image src="/logo.webp" alt="Sri Krishna Margam" width={38} height={38} priority className="rounded-full ring-1 ring-brand-gold/40" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-bold text-brand-gold">{t.nav.platform}</div>
            <div className="truncate text-[10px] text-brand-gold-muted">{t.nav.tagline}</div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setLang(lang === 'en' ? 'te' : 'en')}
          className="rounded-full border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-gold"
          aria-label="Change language"
        >
          {lang === 'en' ? 'EN' : 'తె'}
        </button>

        <Link href={loggedIn ? '/profile' : '/login'} className="grid h-9 w-9 place-items-center rounded-full border border-brand-border text-brand-gold" aria-label={loggedIn ? 'Profile' : 'Sign in'}>
          <UserRound className="h-4 w-4" aria-hidden />
        </Link>

        <details className="relative">
          <summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full border border-brand-border text-brand-gold" aria-label="Open menu">
            <Menu className="h-5 w-5" aria-hidden />
          </summary>
          <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-brand-border bg-brand-card p-2 shadow-xl shadow-black/30">
            <Link href="/explore" className="block rounded-xl px-3 py-2 text-sm text-brand-body hover:bg-brand-gold/10">{lang === 'te' ? 'కోర్సులు' : 'Courses'}</Link>
            {loggedIn && <Link href="/my-courses" className="block rounded-xl px-3 py-2 text-sm text-brand-body hover:bg-brand-gold/10">{t.nav.myCourses}</Link>}
            <Link href="/donate" className="block rounded-xl px-3 py-2 text-sm text-brand-body hover:bg-brand-gold/10">{t.nav.donate}</Link>
            {!loggedIn && <Link href="/login" className="block rounded-xl px-3 py-2 text-sm text-brand-body hover:bg-brand-gold/10">{t.nav.signIn}</Link>}
          </div>
        </details>
      </div>
    </nav>
  )
}
