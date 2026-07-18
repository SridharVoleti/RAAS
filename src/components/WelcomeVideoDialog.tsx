'use client'

import { useEffect, useState } from 'react'
import { X, Play } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'

const WATCHED_KEY = 'km_welcome_watched'

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0]
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/^\/embed\/([^/?]+)/)
      if (m) return m[1]
    }
  } catch {}
  return null
}

interface Props {
  /** Increment to reopen the dialog on demand (e.g. from the home marquee) */
  openSignal?: number
}

export default function WelcomeVideoDialog({ openSignal = 0 }: Props) {
  const { lang } = useLang()
  const [open, setOpen] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [hasWatched, setHasWatched] = useState(false)

  useEffect(() => {
    const watched = localStorage.getItem(WATCHED_KEY) === '1'
    setHasWatched(watched)

    fetch('/api/public/settings')
      .then(r => r.json())
      .then((data: Record<string, string>) => {
        if (data.welcome_video_url) setVideoUrl(data.welcome_video_url)
      })
      .catch(() => {})
  }, [])

  // Opens only when the parent bumps the signal (e.g. the home page's "listen to this video" link)
  useEffect(() => {
    if (openSignal > 0 && videoUrl) setOpen(true)
  }, [openSignal, videoUrl])

  function close() {
    localStorage.setItem(WATCHED_KEY, '1')
    setOpen(false)
  }

  if (!open) return null

  const videoId = extractYouTubeId(videoUrl)
  const embedSrc = videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
    : null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80"
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className="relative w-full max-w-2xl bg-brand-card border border-brand-gold/30 rounded-2xl overflow-hidden shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="px-5 py-4 border-b border-brand-border flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {!hasWatched && (
              <span className="inline-flex items-center gap-1 mb-2 px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-500/20 border border-red-500/40 text-red-400">
                ★ Must Watch
              </span>
            )}
            <h2 className="text-brand-gold font-bold text-sm sm:text-base leading-snug">
              {lang === 'te'
                ? 'శ్రీ కృష్ణమార్గము ఎంఎంఎం దుకుకు మొదలు పెట్టాము?'
                : 'What to expect from Sri Krishna Margam'}
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {hasWatched && (
              <button
                onClick={close}
                className="px-3 py-1.5 text-xs font-semibold text-brand-gold-muted border border-brand-border rounded-lg hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                {lang === 'te' ? 'దాటవేయి' : 'Skip'}
              </button>
            )}
            <button
              onClick={close}
              aria-label="Close"
              className="p-1.5 rounded-lg text-brand-gold-muted hover:text-brand-gold hover:bg-brand-border/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          {embedSrc ? (
            <iframe
              src={embedSrc}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Welcome video"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-brand-bg">
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-2 text-brand-gold hover:text-yellow-300 transition-colors"
              >
                <Play className="w-12 h-12" />
                <span className="text-sm font-medium">
                  {lang === 'te' ? 'వీడియో చూడండి' : 'Watch Video'}
                </span>
              </a>
            </div>
          )}
        </div>

        {/* Footer — shown only on first watch */}
        {!hasWatched && (
          <div className="px-5 py-3 border-t border-brand-border text-center">
            <button
              onClick={close}
              className="text-xs text-brand-gold-muted hover:text-brand-gold transition-colors underline underline-offset-2"
            >
              {lang === 'te' ? 'చూశాను, మూసివేయండి' : "I've watched this — close"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
