'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { Language } from '@/types'
import { translations } from '@/lib/translations'

interface LanguageContextValue {
  lang: Language
  setLang: (l: Language) => void
  t: typeof translations.en
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: translations.en,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en')

  useEffect(() => {
    const stored = localStorage.getItem('km_lang') as Language | null
    if (stored === 'en' || stored === 'te') setLangState(stored)
  }, [])

  function setLang(l: Language) {
    setLangState(l)
    localStorage.setItem('km_lang', l)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: translations[lang] as typeof translations.en }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLang = () => useContext(LanguageContext)
