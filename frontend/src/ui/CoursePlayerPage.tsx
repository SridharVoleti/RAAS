import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import { apiFetch } from '../lib/api'
import { useAuth } from '../lib/auth'

type CourseOutline = {
  course: { id: string; title: string; description: string }
  enrollment_status: string
  lessons: Array<{ id: string; title: string; enabled: boolean; completed: boolean }>
  progress_summary: { total_lessons: number; completed_lessons: number; percent: number }
}

type PlaybackTokenResponse = {
  token: string
}

type HeartbeatResponse = {
  ok: boolean
  completed_now: boolean
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length < 2) return {}
  const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const json = globalThis.atob(padded)
  return JSON.parse(json) as Record<string, unknown>
}

function useYouTubeApiReady(videoId: string | null) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!videoId) return

    const w = globalThis as unknown as {
      YT?: { Player?: unknown }
      onYouTubeIframeAPIReady?: () => void
    }

    if (w.YT && w.YT.Player) {
      setReady(true)
      return
    }

    const existing = document.querySelector('script[data-yt-iframe-api="1"]')
    if (!existing) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      s.setAttribute('data-yt-iframe-api', '1')
      document.body.appendChild(s)
    }

    const prev = w.onYouTubeIframeAPIReady
    w.onYouTubeIframeAPIReady = () => {
      prev?.()
      setReady(true)
    }
  }, [videoId])

  return ready
}

export default function CoursePlayerPage() {
  const { courseId } = useParams()
  const auth = useAuth()
  const qc = useQueryClient()

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const playerHostRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<unknown>(null)
  const heartbeatTimerRef = useRef<number | null>(null)

  if (!courseId) {
    return <div className="text-sm text-slate-600">Missing course.</div>
  }

  const outlineQuery = useQuery({
    queryKey: ['course-outline', courseId],
    queryFn: () => apiFetch<CourseOutline>(`/api/learner/course/${courseId}/outline`, { token: auth.token }),
    enabled: true,
  })

  const suggestedLessonId = (() => {
    const outline = outlineQuery.data
    if (!outline) return null
    const firstEnabledNotCompleted = outline.lessons.find((l) => l.enabled && !l.completed)
    return firstEnabledNotCompleted?.id ?? outline.lessons[0]?.id ?? null
  })()

  const playbackQuery = useQuery({
    queryKey: ['course-playback-token', courseId, selectedLessonId],
    queryFn: () =>
      apiFetch<PlaybackTokenResponse>(`/api/learner/course/${courseId}/playback-token`, {
        method: 'POST',
        token: auth.token,
        body: JSON.stringify({ lesson_id: selectedLessonId }),
      }),
    enabled: Boolean(selectedLessonId),
    retry: false,
  })

  const videoId = useMemo(() => {
    const token = playbackQuery.data?.token
    if (!token) return null
    const payload = decodeJwtPayload(token)
    return (payload.youtube_id as string | undefined) ?? null
  }, [playbackQuery.data?.token])

  const ytReady = useYouTubeApiReady(videoId)

  useEffect(() => {
    return () => {
      if (heartbeatTimerRef.current) {
        window.clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = null
      }

      const p = playerRef.current as { destroy?: () => void } | null
      p?.destroy?.()
      playerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ytReady || !videoId || !playerHostRef.current || !playbackQuery.data?.token) return

    setPlayerError(null)

    if (heartbeatTimerRef.current) {
      window.clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }

    const old = playerRef.current as { destroy?: () => void } | null
    old?.destroy?.()
    playerRef.current = null

    if (playerHostRef.current) {
      playerHostRef.current.innerHTML = ''
    }

    const el = document.createElement('div')
    el.style.width = '100%'
    el.style.height = '100%'
    playerHostRef.current.appendChild(el)

    const w = globalThis as unknown as {
      YT?: {
        Player: new (
          node: HTMLElement,
          opts: {
            host?: string
            videoId: string
            playerVars?: Record<string, unknown>
            events?: {
              onReady?: () => void
              onError?: (e: { data?: number }) => void
            }
          },
        ) => unknown
      }
    }

    if (!w.YT?.Player) return

    const token = playbackQuery.data.token

    playerRef.current = new w.YT.Player(el, {
      host: 'https://www.youtube-nocookie.com',
      videoId,
      playerVars: {
        origin: window.location.origin,
        controls: 0,
        disablekb: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          heartbeatTimerRef.current = window.setInterval(async () => {
            const p = playerRef.current as {
              getCurrentTime?: () => number
              getDuration?: () => number
            } | null

            const position = p?.getCurrentTime?.() ?? 0
            const duration = p?.getDuration?.() ?? 0
            if (!duration || duration <= 0) return

            try {
              const hb = await apiFetch<HeartbeatResponse>(`/api/learner/course/${courseId}/heartbeat`, {
                method: 'POST',
                token: auth.token,
                body: JSON.stringify({ playback_token: token, position_seconds: position, duration_seconds: duration }),
              })

              if (hb.completed_now) {
                qc.invalidateQueries({ queryKey: ['course-outline', courseId] })
              }
            } catch {
              // ignore heartbeat failures; outline will refresh on next navigation
            }
          }, 10_000)
        },
        onError: (e) => {
          const code = e?.data
          setPlayerError(`youtube_error_${String(code ?? 'unknown')}`)
        },
      },
    })
  }, [auth.token, courseId, qc, playbackQuery.data?.token, videoId, ytReady])

  if (outlineQuery.isLoading) {
    return <div className="text-sm text-slate-600">Loading course…</div>
  }

  if (outlineQuery.isError) {
    return <div className="text-sm text-red-700">{(outlineQuery.error as Error).message}</div>
  }

  const outline = outlineQuery.data
  if (!outline) {
    return <div className="text-sm text-slate-600">No course data.</div>
  }

  const activeLessonId = selectedLessonId

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xl font-semibold tracking-tight">{outline.course.title}</div>
        <div className="mt-1 text-sm text-slate-600">{outline.course.description}</div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm font-semibold">Progress</div>
          <div className="text-sm text-slate-600">
            {outline.progress_summary.completed_lessons}/{outline.progress_summary.total_lessons}
          </div>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${Math.round(outline.progress_summary.percent * 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-xl border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold">Course content</div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {outline.lessons.map((l, idx) => {
              const isActive = l.id === activeLessonId
              const state = l.completed ? 'Completed' : l.enabled ? 'Available' : 'Locked'
              return (
                <button
                  key={l.id}
                  className={
                    'mb-2 w-full rounded-lg border p-3 text-left text-sm ' +
                    (isActive ? 'border-slate-900 bg-slate-50' : 'bg-white hover:bg-slate-50') +
                    (!l.enabled ? ' opacity-60' : '')
                  }
                  disabled={!l.enabled}
                  onClick={() => setSelectedLessonId(l.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {idx + 1}. {l.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-600">{state}</div>
                    </div>
                    <div className="text-xs text-slate-500">{l.completed ? '✓' : ''}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="rounded-xl border bg-white">
          <div className="border-b px-4 py-3 text-sm font-semibold">Player</div>
          <div className="p-4">
            {outline.enrollment_status !== 'active' ? (
              <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">Enroll and get approved to play.</div>
            ) : !selectedLessonId ? (
              <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
                Select a lesson to start.
                {suggestedLessonId ? <div className="mt-2 text-xs text-slate-600">Suggested next lesson is available.</div> : null}
              </div>
            ) : playbackQuery.isLoading ? (
              <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">Preparing player…</div>
            ) : playbackQuery.isError ? (
              <div className="rounded-lg border bg-red-50 p-4 text-sm text-red-700">{(playbackQuery.error as Error).message}</div>
            ) : !videoId ? (
              <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">Unable to load video.</div>
            ) : (
              <div className="space-y-3">
                {playerError ? (
                  <div className="rounded-lg border bg-red-50 p-3 text-sm text-red-700">
                    Player error: {playerError}. If this persists, the YouTube video is likely blocked from embedding
                    (private/age-restricted/embedding disabled/region restricted).
                  </div>
                ) : null}
                <div className="rounded-lg border bg-white p-2">
                  <div ref={playerHostRef} className="aspect-[21/9] w-full" />
                </div>
                <div className="text-xs text-slate-600">Keep watching to 95% to unlock the next lesson.</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
