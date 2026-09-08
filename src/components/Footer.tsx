'use client'

import { useLang } from '@/contexts/LanguageContext'

export default function Footer() {
  const { t } = useLang()
  return (
    <footer className="hidden md:block border-t border-brand-border bg-brand-card mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8 text-center">
        <div className="text-brand-gold text-2xl mb-2">ॐ</div>
        <p className="text-brand-gold-muted text-sm">{t.footer.copyright}</p>
      </div>
    </footer>
  )
}
