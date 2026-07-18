'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Award, Download, Eye } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'

interface EarnedCertificate {
  courseId: number
  courseTitle: string
  courseTitleTe: string | null
  completedAt: string
  emoji: string
}

export default function MyCertificatesPage() {
  const { lang, t } = useLang()
  const router = useRouter()
  const [certs, setCerts] = useState<EarnedCertificate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?returnTo=/my-certificates'); return }

      const res = await fetch('/api/my-certificates')
      if (res.ok) {
        const data = await res.json()
        setCerts(data.certificates ?? [])
      }
      setLoading(false)
    }
    load()
  // router is stable from Next.js
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-4xl animate-pulse">ॐ</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-brand-gold font-bold text-2xl flex items-center gap-2">
            <Award className="w-6 h-6" />
            {t.cert.pageTitle}
          </h1>
          <p className="text-brand-gold-muted text-sm mt-1">{t.cert.pageSubtitle}</p>
        </div>

        {certs.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🪷</div>
            <p className="text-brand-gold-muted text-sm mb-6">{t.cert.empty}</p>
            <Link
              href="/explore"
              className="inline-block px-6 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm"
            >
              {t.cert.exploreCourses}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {certs.map(cert => (
              <div
                key={cert.courseId}
                className="bg-brand-card border border-brand-border rounded-2xl p-5 flex flex-col gap-4 hover:border-brand-gold/60 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none">{cert.emoji}</span>
                  <div className="min-w-0">
                    <h2 className="text-brand-gold font-bold leading-snug">
                      {lang === 'te' && cert.courseTitleTe ? cert.courseTitleTe : cert.courseTitle}
                    </h2>
                    <p className="text-brand-gold-muted text-xs mt-1">
                      {t.cert.completedOn}{' '}
                      {new Date(cert.completedAt).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-IN', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-auto">
                  <a
                    href={`/api/certificate/${cert.courseId}/pdf`}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    {t.cert.download}
                  </a>
                  <Link
                    href={`/certificate/${cert.courseId}`}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 border border-brand-gold text-brand-gold text-sm font-semibold rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    {t.cert.view}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
