'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface CertData {
  studentName: string
  courseTitle: string
  courseTitleTe: string | null
  completedAt: string
  emoji: string
  courseId: number
}

export default function CertificatePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params?.courseId as string

  const [cert, setCert] = useState<CertData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/certificate/${courseId}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to load certificate')
        setLoading(false)
        return
      }
      setCert(await res.json())
      setLoading(false)
    }
    if (courseId) load()
  }, [courseId])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-5xl animate-pulse">ॐ</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🪷</div>
          <h2 className="text-brand-gold font-bold text-xl mb-2">Certificate Unavailable</h2>
          <p className="text-brand-gold-muted text-sm mb-6">{error}</p>
          <button
            onClick={() => router.push('/my-courses')}
            className="px-6 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
          >
            Back to My Courses
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Actions bar */}
      <div className="bg-brand-card border-b border-brand-border px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/my-courses')}
          className="text-brand-gold-muted text-sm hover:text-brand-gold transition-colors"
        >
          ← My Courses
        </button>
        <a
          href={`/api/certificate/${courseId}/pdf`}
          className="px-5 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm"
        >
          ⬇ Download Certificate (PDF)
        </a>
      </div>

      {/* Congratulations + PDF preview */}
      <div className="flex-1 flex flex-col items-center p-4 sm:p-8 gap-6">
        <div className="text-center">
          <div className="text-4xl mb-2">{cert!.emoji}</div>
          <h1 className="text-brand-gold font-bold text-2xl mb-1">Congratulations, {cert!.studentName}!</h1>
          <p className="text-brand-gold-muted text-sm">
            You have completed <strong>{cert!.courseTitleTe ?? cert!.courseTitle}</strong>.
            Your certificate is ready to download.
          </p>
        </div>

        {/* Inline preview — some mobile browsers can't render PDFs in a frame,
            so the download button above is always the primary action */}
        <iframe
          src={`/api/certificate/${courseId}/pdf?inline=1`}
          title="Certificate preview"
          className="w-full max-w-4xl aspect-[1600/1135] rounded-xl border border-brand-border bg-white shadow-2xl"
        />
      </div>
    </div>
  )
}
