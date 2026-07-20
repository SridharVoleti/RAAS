'use client'

import { useEffect, useState } from 'react'
import { useLang } from '@/contexts/LanguageContext'

interface Props {
  launchAt: string
}

interface Remaining {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getRemaining(launchAt: string): Remaining {
  const diff = Math.max(0, new Date(launchAt).getTime() - Date.now())
  const totalSeconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

export default function LaunchCountdown({ launchAt }: Props) {
  const { t } = useLang()
  const [remaining, setRemaining] = useState<Remaining | null>(null)

  useEffect(() => {
    setRemaining(getRemaining(launchAt))
    const interval = setInterval(() => {
      const next = getRemaining(launchAt)
      setRemaining(next)
      if (next.days === 0 && next.hours === 0 && next.minutes === 0 && next.seconds === 0) {
        clearInterval(interval)
        window.location.reload()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [launchAt])

  const tiles: Array<{ label: string; value: number }> = remaining
    ? [
        { label: t.launch.days, value: remaining.days },
        { label: t.launch.hours, value: remaining.hours },
        { label: t.launch.minutes, value: remaining.minutes },
        { label: t.launch.seconds, value: remaining.seconds },
      ]
    : []

  return (
    <div className="w-full bg-brand-card border-b border-brand-border py-6 px-4 text-center">
      <h2 className="text-brand-gold text-xl sm:text-2xl font-bold mb-1">{t.launch.heading}</h2>
      <p className="text-brand-body text-sm max-w-xl mx-auto mb-4">{t.launch.subtitle}</p>
      <div className="flex items-center justify-center gap-3 sm:gap-4" suppressHydrationWarning>
        {tiles.map(tile => (
          <div key={tile.label} className="bg-brand-bg border border-brand-border rounded-lg px-3 py-2 min-w-[64px]">
            <div className="text-brand-gold text-2xl sm:text-3xl font-bold tabular-nums">
              {String(tile.value).padStart(2, '0')}
            </div>
            <div className="text-brand-gold-muted text-xs uppercase tracking-wide">{tile.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
