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

  const formattedDate = cert
    ? new Date(cert.completedAt).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center print:hidden">
        <div className="text-brand-gold text-5xl animate-pulse">ॐ</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 print:hidden">
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
    <>
      {/* Print styles injected inline */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .cert-wrapper { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        }
        @page { size: A4 landscape; margin: 1cm; }
      `}</style>

      {/* Actions bar — hidden on print */}
      <div className="no-print bg-brand-card border-b border-brand-border px-6 py-3 flex items-center justify-between">
        <button
          onClick={() => router.push('/my-courses')}
          className="text-brand-gold-muted text-sm hover:text-brand-gold transition-colors"
        >
          ← My Courses
        </button>
        <button
          onClick={() => window.print()}
          className="px-5 py-2 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm"
        >
          Download / Print PDF
        </button>
      </div>

      {/* Certificate */}
      <div className="cert-wrapper min-h-[calc(100vh-52px)] bg-brand-bg flex items-center justify-center p-8 print:min-h-screen print:bg-white print:p-0">
        <div className="cert relative w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl print:shadow-none print:rounded-none"
             style={{ border: '12px solid #f0b429', outline: '2px solid #a07030' }}>

          {/* Inner border */}
          <div className="m-4 border-2 border-brand-gold/30 rounded-xl p-8 text-center"
               style={{ background: 'linear-gradient(135deg, #fffdf5 0%, #fff8e0 100%)' }}>

            {/* Top decoration */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, #f0b429)' }} />
              <span className="text-5xl" style={{ color: '#a07030' }}>ॐ</span>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, #f0b429)' }} />
            </div>

            <p className="text-xs font-semibold tracking-[0.3em] uppercase mb-2" style={{ color: '#a07030' }}>
              Krishnamargam — BabyStepsIndia
            </p>

            <h1 className="text-4xl font-bold mb-1" style={{ color: '#1a0f00', fontFamily: 'Georgia, serif' }}>
              Certificate of Completion
            </h1>
            <p className="text-sm mb-6" style={{ color: '#a07030' }}>This is to certify that</p>

            <div className="mb-2">
              <span className="text-3xl font-bold" style={{ color: '#1a0f00', fontFamily: 'Georgia, serif', borderBottom: '2px solid #f0b429', paddingBottom: '4px' }}>
                {cert!.studentName}
              </span>
            </div>

            <p className="text-sm mb-6 mt-4" style={{ color: '#5a3e00' }}>
              has successfully completed the course
            </p>

            <div className="mb-6 px-8">
              <div className="inline-block px-6 py-3 rounded-xl" style={{ background: '#fff3cc', border: '1px solid #f0b429' }}>
                <span className="text-2xl mr-2">{cert!.emoji}</span>
                <span className="text-xl font-bold" style={{ color: '#1a0f00' }}>{cert!.courseTitle}</span>
                {cert!.courseTitleTe && (
                  <p className="text-sm mt-1" style={{ color: '#a07030' }}>{cert!.courseTitleTe}</p>
                )}
              </div>
            </div>

            <p className="text-sm mb-8" style={{ color: '#5a3e00' }}>
              Completed on <strong>{formattedDate}</strong>
            </p>

            {/* Footer */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to right, transparent, #f0b429)' }} />
              <span className="text-2xl" style={{ color: '#a07030' }}>🪷</span>
              <div className="h-px flex-1" style={{ background: 'linear-gradient(to left, transparent, #f0b429)' }} />
            </div>

            <p className="text-xs mt-3" style={{ color: '#a07030' }}>
              krishnamargam.in · babystepsindia.in
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
