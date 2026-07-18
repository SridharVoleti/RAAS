'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { CheckCircle2, ChevronLeft, ChevronRight, BookOpen, FileText, HelpCircle, Layers, Loader2 } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import type { Chapter, Course, Lesson, QuizQuestion_Public, QuizSubmission, QuizResult } from '@/types'

// ── YouTube IFrame API types ─────────────────────────────────────────────────
declare global {
  interface Window {
    YT: {
      Player: new (el: string | HTMLElement, opts: YTPlayerOptions) => YTPlayer
      PlayerState: { ENDED: 0; PLAYING: 1; PAUSED: 2 }
    }
    onYouTubeIframeAPIReady?: () => void
  }
}
type YTPlayerOptions = {
  videoId?: string
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: () => void
    onStateChange?: (e: { data: number }) => void
  }
}
type YTPlayer = {
  loadVideoById: (videoId: string, startSeconds?: number) => void
  cueVideoById: (videoId: string, startSeconds?: number) => void
  pauseVideo: () => void
  destroy: () => void
  getCurrentTime: () => number
  getDuration: () => number
}

const QUIZ_PASS_PCT = 80
// A lesson only counts as "watched" if genuine playback (not seek-jumps) covers
// this fraction of the video. Prevents marking complete by dragging to the end.
const MIN_WATCH_RATIO = 0.85
const SEEK_JUMP_TOLERANCE_SEC = 2
const CHAPTER_QUIZ_PASS_SCORE = 3
const POSITION_SAVE_INTERVAL_SEC = 10

// Chapter quizzes are always 5 questions — message text is tuned for that.
function getChapterQuizMessage(score: number, lang: string): string | undefined {
  if (lang !== 'te') return undefined
  if (score >= 5) return 'అద్భుతం! మీరు అన్ని ప్రశ్నలకి సరైన సమాధానము చెప్పారు.'
  if (score === 4) return 'చాలా బాగుంది! మీరు 4గింటికి సరైన సమాధానము ఇచ్చారు.'
  if (score === 3) return 'బాగుంది! మీరు 5 దింట 3కి సమాధానం సరిగ్గా ఇచ్చారు.'
  return 'మీరు పాఠం మళ్ళీ బాగా విని, చదివి పరీక్ష మళ్ళీ ప్రయత్నించండి.'
}

interface Props {
  course: Course
  lessons: Lesson[]
  completedLessonIds: number[]
  initialLessonIndex: number
  lessonPositions?: Record<number, number>
  quizQuestions?: QuizQuestion_Public[]
  quizSubmissions?: QuizSubmission[]
  chapters?: Chapter[]
  chapterQuestionCounts?: Record<number, number>
  chapterSubmissions?: QuizSubmission[]
}

type TabType = 'lessons' | 'notes'

function loadYTScript(cb: () => void) {
  if (typeof window === 'undefined') return
  if (window.YT?.Player) { cb(); return }
  const prev = window.onYouTubeIframeAPIReady
  window.onYouTubeIframeAPIReady = () => { prev?.(); cb() }
  if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(s)
  }
}

function isLastLessonInChapter(lesson: Lesson, allLessons: Lesson[]): boolean {
  if (!lesson.chapter_id) return false
  const chapterLessons = allLessons.filter(l => l.chapter_id === lesson.chapter_id)
  const maxOrder = Math.max(...chapterLessons.map(l => l.order_index))
  return lesson.order_index === maxOrder
}

export default function WatchClient({
  course, lessons, completedLessonIds, initialLessonIndex, lessonPositions: initialLessonPositions = {},
  quizQuestions = [], quizSubmissions = [],
  chapters = [], chapterQuestionCounts = {}, chapterSubmissions = [],
}: Props) {
  const { lang, t } = useLang()
  const router = useRouter()
  const pathname = usePathname()
  const [currentIdx, setCurrentIdx] = useState(initialLessonIndex)
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set(completedLessonIds))
  const [lessonPositions, setLessonPositions] = useState<Record<number, number>>(initialLessonPositions)
  const [viewingQuiz, setViewingQuiz] = useState(false)
  const [chapterQuizState, setChapterQuizState] = useState<{ chapterId: number; chapterTitle: string } | null>(null)
  const [passedQuizIds, setPassedQuizIds] = useState<Set<number>>(() => new Set(
    quizSubmissions
      .filter(s => s.lesson_id !== undefined && s.total_questions > 0 && (s.score / s.total_questions) * 100 >= QUIZ_PASS_PCT)
      .map(s => s.lesson_id as number)
  ))
  const [passedChapterQuizIds, setPassedChapterQuizIds] = useState<Set<number>>(() => new Set(
    chapterSubmissions
      .filter(s => s.chapter_id !== undefined && s.score >= CHAPTER_QUIZ_PASS_SCORE)
      .map(s => s.chapter_id as number)
  ))
  const [activeTab, setActiveTab] = useState<TabType>('lessons')
  const [notes, setNotes] = useState('')
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [marking, setMarking] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [watchWarning, setWatchWarning] = useState(false)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  const playerRef = useRef<YTPlayer | null>(null)
  const playerReadyRef = useRef(false)
  const currentIdxRef = useRef(currentIdx)
  const completedIdsRef = useRef(completedIds)
  const markingRef = useRef(marking)
  const viewingQuizRef = useRef(viewingQuiz)
  const passedQuizIdsRef = useRef(passedQuizIds)
  const passedChapterQuizIdsRef = useRef(passedChapterQuizIds)
  const watchedSecondsRef = useRef(0)
  const lastSampleTimeRef = useRef<number | null>(null)
  const watchPollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeLessonIdRef = useRef<number | null>(null)
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])
  useEffect(() => { completedIdsRef.current = completedIds }, [completedIds])
  useEffect(() => { markingRef.current = marking }, [marking])
  useEffect(() => { viewingQuizRef.current = viewingQuiz }, [viewingQuiz])
  useEffect(() => { passedQuizIdsRef.current = passedQuizIds }, [passedQuizIds])
  useEffect(() => { passedChapterQuizIdsRef.current = passedChapterQuizIds }, [passedChapterQuizIds])

  const currentLesson = lessons[currentIdx]
  const completedCount = completedIds.size
  const totalLessons = lessons.length
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0
  const isCurrentComplete = currentLesson ? completedIds.has(currentLesson.id) : false

  // Quiz data for the current lesson (only questions with a lesson_id)
  const quizCounts = quizQuestions.reduce<Record<number, number>>((acc, q) => {
    if (q.lesson_id !== undefined) acc[q.lesson_id] = (acc[q.lesson_id] || 0) + 1
    return acc
  }, {})
  const currentQuizQuestions = quizQuestions.filter(q => q.lesson_id === currentLesson?.id)
  const bestSubmission = quizSubmissions
    .filter(s => s.lesson_id === currentLesson?.id)
    .reduce<QuizSubmission | null>((best, s) => {
      if (!best) return s
      const bestPct = best.total_questions > 0 ? best.score / best.total_questions : 0
      const sPct = s.total_questions > 0 ? s.score / s.total_questions : 0
      return sPct > bestPct ? s : best
    }, null)

  // Best chapter quiz submission for the active chapter quiz
  const bestChapterSubmission = chapterQuizState
    ? chapterSubmissions
        .filter(s => s.chapter_id === chapterQuizState.chapterId)
        .reduce<QuizSubmission | null>((best, s) => {
          if (!best) return s
          return (s.score / s.total_questions) > (best.score / best.total_questions) ? s : best
        }, null)
    : null

  function selectLesson(idx: number) {
    setCurrentIdx(idx)
    setViewingQuiz(false)
    setChapterQuizState(null)
  }

  function selectQuiz(idx: number) {
    setCurrentIdx(idx)
    setViewingQuiz(true)
    setChapterQuizState(null)
    if (playerReadyRef.current) playerRef.current?.pauseVideo()
  }

  function selectChapterQuiz(chapterId: number) {
    const chapter = chapters.find(c => c.id === chapterId)
    const chapterTitle = (lang === 'te' && chapter?.title_te ? chapter.title_te : chapter?.title_en) ?? 'Chapter Quiz'
    setChapterQuizState({ chapterId, chapterTitle })
    setViewingQuiz(false)
    if (playerReadyRef.current) playerRef.current?.pauseVideo()
  }

  function handleQuizPassed(lessonId: number) {
    setPassedQuizIds(prev => new Set([...prev, lessonId]))
  }

  function handleChapterQuizPassed(chapterId: number) {
    setPassedChapterQuizIds(prev => new Set([...prev, chapterId]))
  }

  // ── Course-completion congratulations popup ────────────────
  const requiredChapterIds = chapters
    .filter(c => (chapterQuestionCounts[c.id] || 0) > 0)
    .map(c => c.id)
  const fullyComplete =
    totalLessons > 0 &&
    completedCount === totalLessons &&
    requiredChapterIds.every(id => passedChapterQuizIds.has(id))
  const [showCongrats, setShowCongrats] = useState(false)
  const completeOnMountRef = useRef(fullyComplete)
  const congratsCheckedRef = useRef(false)

  useEffect(() => {
    // Fire only when the final tick lands in this session, and only if the
    // server confirms certificate eligibility (path rules, track rules)
    if (!fullyComplete || completeOnMountRef.current || congratsCheckedRef.current) return
    congratsCheckedRef.current = true
    fetch(`/api/certificate/${course.id}`)
      .then(res => {
        if (!res.ok) return
        setShowCongrats(true)
        // refresh the navbar's per-session "has certificates" cache
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i)
          if (key?.startsWith('km_has_certs_')) sessionStorage.setItem(key, '1')
        }
      })
      .catch(() => {})
  }, [fullyComplete, course.id])

  useEffect(() => {
    fetch(`/api/notes/${course.id}`)
      .then(r => r.json())
      .then((data: { content?: string }) => setNotes(data.content || ''))
      .catch(() => {})
  }, [course.id])

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    router.replace(`${pathname}?lesson=${currentIdx}`, { scroll: false })
  }, [currentIdx, pathname, router])

  useEffect(() => {
    const active = sidebarRef.current?.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentIdx])

  useEffect(() => {
    if (lessons.length === 0) return
    const initialLesson = lessons[initialLessonIndex]
    activeLessonIdRef.current = initialLesson?.id ?? null
    const resumeAt = initialLesson ? (initialLessonPositions[initialLesson.id] ?? 0) : 0
    loadYTScript(() => {
      playerRef.current = new window.YT.Player('yt-player', {
        videoId: initialLesson?.youtube_video_id,
        playerVars: {
          rel: 0, modestbranding: 1, enablejsapi: 1, origin: window.location.origin,
          ...(resumeAt > 0 ? { start: Math.floor(resumeAt) } : {}),
        },
        events: {
          onReady: () => { playerReadyRef.current = true },
          onStateChange: (e) => {
            if (e.data === 1) startWatchPolling()
            else stopWatchPolling()
            if (e.data === 0) handleVideoEnded()
          },
        },
      })
    })
    return () => {
      stopWatchPolling()
      playerRef.current?.destroy()
      playerRef.current = null
      playerReadyRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!currentLesson) return
    // Persist the outgoing lesson's last known position, then switch tracking to the new one.
    stopWatchPolling()
    activeLessonIdRef.current = currentLesson.id
    watchedSecondsRef.current = 0
    lastSampleTimeRef.current = null
    if (playerReadyRef.current && playerRef.current) {
      const resumeAt = lessonPositions[currentLesson.id] ?? 0
      if (viewingQuizRef.current || chapterQuizState) playerRef.current.cueVideoById(currentLesson.youtube_video_id, resumeAt)
      else playerRef.current.loadVideoById(currentLesson.youtube_video_id, resumeAt)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLesson?.youtube_video_id])

  function savePosition(lessonId: number, seconds: number) {
    const rounded = Math.floor(seconds)
    if (rounded < 1) return
    setLessonPositions(prev => ({ ...prev, [lessonId]: rounded }))
    fetch(`/api/progress/${course.id}/lesson/${lessonId}/position`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionSeconds: rounded }),
    }).catch(() => {})
  }

  function stopWatchPolling() {
    if (watchPollRef.current) {
      clearInterval(watchPollRef.current)
      watchPollRef.current = null
    }
    if (activeLessonIdRef.current !== null && lastSampleTimeRef.current !== null) {
      savePosition(activeLessonIdRef.current, lastSampleTimeRef.current)
    }
  }

  function startWatchPolling() {
    stopWatchPolling()
    let tick = 0
    watchPollRef.current = setInterval(() => {
      const player = playerRef.current
      if (!player) return
      const current = player.getCurrentTime()
      const last = lastSampleTimeRef.current
      if (last !== null) {
        const delta = current - last
        // Only credit forward playback within tolerance as "watched" —
        // large jumps (seeking ahead) don't count, so dragging to the
        // end doesn't fake a full watch.
        if (delta > 0 && delta <= SEEK_JUMP_TOLERANCE_SEC) {
          watchedSecondsRef.current += delta
        }
      }
      lastSampleTimeRef.current = current
      tick += 1
      if (tick % POSITION_SAVE_INTERVAL_SEC === 0 && activeLessonIdRef.current !== null) {
        savePosition(activeLessonIdRef.current, current)
      }
    }, 1000)
  }

  function handleVideoEnded() {
    const duration = playerRef.current?.getDuration() ?? 0
    if (duration > 0 && watchedSecondsRef.current < duration * MIN_WATCH_RATIO) {
      setWatchWarning(true)
      setTimeout(() => setWatchWarning(false), 4000)
      return
    }
    autoMarkComplete()
  }

  async function autoMarkComplete() {
    const lesson = lessons[currentIdxRef.current]
    if (!lesson || completedIdsRef.current.has(lesson.id) || markingRef.current) return
    markingRef.current = true
    setMarking(true)
    try {
      const res = await fetch(`/api/progress/${course.id}/lesson/${lesson.id}`, { method: 'POST' })
      if (res.ok) {
        setCompletedIds(prev => new Set([...prev, lesson.id]))
        setJustCompleted(true)
        setTimeout(() => setJustCompleted(false), 3000)

        const hasUnpassedLessonQuiz = (quizCounts[lesson.id] || 0) > 0 && !passedQuizIdsRef.current.has(lesson.id)
        if (hasUnpassedLessonQuiz) {
          setViewingQuiz(true)
        } else {
          // Check if this is the last lesson of its chapter and the chapter has quiz questions
          const isLastInChapter = isLastLessonInChapter(lesson, lessons)
          const chapterHasQuiz = lesson.chapter_id && (chapterQuestionCounts[lesson.chapter_id] || 0) > 0
          const chapterAlreadyPassed = lesson.chapter_id && passedChapterQuizIdsRef.current.has(lesson.chapter_id)

          if (isLastInChapter && chapterHasQuiz && !chapterAlreadyPassed) {
            const chapter = chapters.find(c => c.id === lesson.chapter_id)
            const chapterTitle = (lang === 'te' && chapter?.title_te ? chapter.title_te : chapter?.title_en) ?? 'Chapter Quiz'
            setChapterQuizState({ chapterId: lesson.chapter_id!, chapterTitle })
          } else if (currentIdxRef.current < lessons.length - 1) {
            setCurrentIdx(prev => prev + 1)
          }
        }
      }
    } finally {
      markingRef.current = false
      setMarking(false)
    }
  }

  function handleNotesChange(value: string) {
    setNotes(value)
    setNotesStatus('idle')
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      setNotesStatus('saving')
      fetch(`/api/notes/${course.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: value }),
      })
        .then(() => { setNotesStatus('saved'); setTimeout(() => setNotesStatus('idle'), 2000) })
        .catch(() => setNotesStatus('idle'))
    }, 1500)
  }

  const title = lang === 'te' && currentLesson?.title_te ? currentLesson.title_te : currentLesson?.title_en
  const courseTitle = lang === 'te' ? course.title_te : course.title_en

  // Determine whether the video area is hidden (quiz panels take over)
  const videoHidden = viewingQuiz || !!chapterQuizState

  if (lessons.length === 0) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-brand-gold-muted">{t.watch.noLessons}</p>
          <Link href="/my-courses" className="mt-4 inline-block text-brand-gold hover:underline text-sm">
            {t.watch.backToMyCourses}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Top bar */}
      <header className="bg-brand-card border-b border-brand-border px-4 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/my-courses"
          className="flex items-center gap-1.5 text-brand-gold-muted hover:text-brand-gold transition-colors text-sm flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t.watch.backToMyCourses}</span>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-brand-gold font-semibold text-sm truncate">{courseTitle}</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:block w-24 h-1.5 bg-brand-border rounded-full overflow-hidden">
            <div className="h-full bg-brand-gold rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-brand-gold-muted text-xs whitespace-nowrap">{completedCount}/{totalLessons}</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: video + controls + quiz + notes */}
        <div className="flex-1 flex flex-col overflow-y-auto">

          {justCompleted && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-brand-success text-brand-bg text-sm font-semibold rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" />
              {t.watch.lessonCompleted}
            </div>
          )}

          {watchWarning && (
            <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-brand-error text-brand-bg text-sm font-semibold rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
              {t.watch.watchIncomplete}
            </div>
          )}

          {showCongrats && (
            <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center px-4">
              <div className="bg-brand-card border border-brand-gold/50 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-brand-gold font-bold text-2xl mb-2">{t.cert.congratsTitle}</h2>
                <p className="text-brand-body text-sm mb-6">{t.cert.congratsBody}</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    onClick={() => router.push('/my-certificates')}
                    className="px-5 py-2.5 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                  >
                    {t.cert.goToMyCertificates}
                  </button>
                  <button
                    onClick={() => setShowCongrats(false)}
                    className="px-5 py-2.5 border border-brand-border text-brand-gold-muted text-sm font-semibold rounded-lg hover:text-brand-gold hover:border-brand-gold transition-colors"
                  >
                    {t.cert.later}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Video (kept mounted but hidden while a quiz panel is open) */}
          <div className={`relative w-full bg-black ${videoHidden ? 'hidden' : ''}`} style={{ paddingBottom: videoHidden ? 0 : '56.25%' }}>
            <div id="yt-player" className="absolute inset-0 w-full h-full" />
            <div className="absolute top-0 left-0 right-0 h-10 z-10" style={{ pointerEvents: 'all' }} />
            <div className="absolute bottom-0 right-0 w-24 h-10 z-10" style={{ pointerEvents: 'all' }} />
          </div>

          {/* Lesson quiz player */}
          {viewingQuiz && currentQuizQuestions.length > 0 && (
            <QuizPlayer
              key={currentLesson.id}
              lessonId={currentLesson.id}
              questions={currentQuizQuestions}
              bestSubmission={bestSubmission}
              alreadyPassed={passedQuizIds.has(currentLesson.id)}
              lang={lang}
              tQuiz={t.quiz}
              onPassed={handleQuizPassed}
              onNextLesson={currentIdx < lessons.length - 1 ? () => selectLesson(currentIdx + 1) : null}
            />
          )}

          {/* Chapter quiz player — triggered after last lesson of a chapter */}
          {chapterQuizState && (
            <ChapterQuizPlayer
              key={chapterQuizState.chapterId}
              chapterId={chapterQuizState.chapterId}
              chapterTitle={chapterQuizState.chapterTitle}
              bestSubmission={bestChapterSubmission}
              alreadyPassed={passedChapterQuizIds.has(chapterQuizState.chapterId)}
              lang={lang}
              tQuiz={t.quiz}
              onPassed={handleChapterQuizPassed}
              onNextLesson={currentIdx < lessons.length - 1 ? () => selectLesson(currentIdx + 1) : null}
            />
          )}

          {/* Lesson title + prev/next controls */}
          <div className={`p-4 border-b border-brand-border ${videoHidden ? 'hidden' : ''}`}>
            <h2 className="text-brand-gold font-semibold text-base mb-1">{title}</h2>
            {currentLesson.duration && (
              <p className="text-brand-gold-muted text-xs mb-3">{currentLesson.duration}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx(i => i - 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-border text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                {t.watch.prev}
              </button>

              {isCurrentComplete ? (
                <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-brand-success/20 text-brand-success border border-brand-success">
                  <CheckCircle2 className="w-4 h-4" />
                  {t.watch.markedComplete}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm text-brand-gold-muted border border-brand-border">
                  {marking ? '...' : t.watch.watchToComplete}
                </span>
              )}

              <button
                disabled={currentIdx === lessons.length - 1}
                onClick={() => setCurrentIdx(i => i + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-border text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
              >
                {t.watch.next}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mobile tabs */}
          <div className="lg:hidden flex border-b border-brand-border">
            <button
              onClick={() => setActiveTab('lessons')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === 'lessons' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-brand-gold-muted'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              {t.watch.lessons}
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === 'notes' ? 'text-brand-gold border-b-2 border-brand-gold' : 'text-brand-gold-muted'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t.watch.notes}
            </button>
          </div>

          {/* Mobile panel */}
          <div className="lg:hidden flex-1">
            {activeTab === 'lessons' && (
              <LessonList
                lessons={lessons}
                currentIdx={currentIdx}
                completedIds={completedIds}
                lang={lang}
                onSelect={selectLesson}
                sidebarRef={undefined}
                quizCounts={quizCounts}
                passedQuizIds={passedQuizIds}
                viewingQuiz={viewingQuiz}
                onSelectQuiz={selectQuiz}
                tQuiz={t.quiz}
                chapterQuestionCounts={chapterQuestionCounts}
                passedChapterQuizIds={passedChapterQuizIds}
                activeChapterId={chapterQuizState?.chapterId ?? null}
                onSelectChapterQuiz={selectChapterQuiz}
              />
            )}
            {activeTab === 'notes' && (
              <NotesPanel notes={notes} status={notesStatus} placeholder={t.watch.notesPlaceholder} savingLabel={t.watch.notesSaving} savedLabel={t.watch.notesSaved} label={t.watch.notes} onChange={handleNotesChange} />
            )}
          </div>

          {/* Desktop: notes always visible */}
          <div className="hidden lg:block p-4 flex-1">
            <NotesPanel notes={notes} status={notesStatus} placeholder={t.watch.notesPlaceholder} savingLabel={t.watch.notesSaving} savedLabel={t.watch.notesSaved} label={t.watch.notes} onChange={handleNotesChange} />
          </div>
        </div>

        {/* Right: lesson sidebar (desktop only) */}
        <aside className="hidden lg:flex flex-col w-80 border-l border-brand-border overflow-y-auto flex-shrink-0 bg-brand-card">
          <div className="p-4 border-b border-brand-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-brand-gold font-semibold text-sm">{t.watch.lessons}</span>
              <span className="text-brand-gold-muted text-xs">{completedCount}/{totalLessons}</span>
            </div>
            <div className="h-1.5 bg-brand-border rounded-full overflow-hidden">
              <div className="h-full bg-brand-gold rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <LessonList
            lessons={lessons}
            currentIdx={currentIdx}
            completedIds={completedIds}
            lang={lang}
            onSelect={selectLesson}
            sidebarRef={sidebarRef}
            quizCounts={quizCounts}
            passedQuizIds={passedQuizIds}
            viewingQuiz={viewingQuiz}
            onSelectQuiz={selectQuiz}
            tQuiz={t.quiz}
            chapterQuestionCounts={chapterQuestionCounts}
            passedChapterQuizIds={passedChapterQuizIds}
            activeChapterId={chapterQuizState?.chapterId ?? null}
            onSelectChapterQuiz={selectChapterQuiz}
          />
        </aside>
      </div>
    </div>
  )
}

// ── Lesson quiz: one MCQ at a time, scorecard at the end ─────────────────────
function QuizPlayer({ lessonId, questions, bestSubmission, alreadyPassed, lang, tQuiz, onPassed, onNextLesson }: {
  lessonId: number
  questions: QuizQuestion_Public[]
  bestSubmission: QuizSubmission | null
  alreadyPassed: boolean
  lang: string
  tQuiz: typeof import('@/lib/translations').translations.en.quiz
  onPassed: (lessonId: number) => void
  onNextLesson: (() => void) | null
}) {
  type Phase = 'question' | 'result'
  const [phase, setPhase] = useState<Phase>(alreadyPassed ? 'result' : 'question')
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, 'a' | 'b' | 'c' | 'd'>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const OPTIONS: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd']
  const question = questions[qIdx]
  const selected = question ? answers[question.id] : undefined
  const isLast = qIdx === questions.length - 1

  function getOptionText(q: QuizQuestion_Public, opt: 'a' | 'b' | 'c' | 'd') {
    const te = q[`option_${opt}_te` as keyof QuizQuestion_Public] as string | undefined
    const en = q[`option_${opt}_en` as keyof QuizQuestion_Public] as string
    return lang === 'te' && te ? te : en
  }

  function getQuestion(q: QuizQuestion_Public) {
    return lang === 'te' && q.question_te ? q.question_te : q.question_en
  }

  async function handleNext() {
    if (!selected) return
    if (!isLast) { setQIdx(i => i + 1); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/quiz/lesson/${lessonId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as { error?: string }))
        setError(d.error || 'Submission failed')
        return
      }
      const data: QuizResult = await res.json()
      setResult(data)
      setPhase('result')
      if (data.total > 0 && (data.score / data.total) * 100 >= QUIZ_PASS_PCT) onPassed(lessonId)
    } finally {
      setSubmitting(false)
    }
  }

  function handleRetry() {
    setAnswers({})
    setQIdx(0)
    setResult(null)
    setError('')
    setPhase('question')
  }

  const score = result?.score ?? bestSubmission?.score ?? 0
  const total = result?.total ?? bestSubmission?.total_questions ?? questions.length
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const passed = pct >= QUIZ_PASS_PCT

  return (
    <QuizShell
      header={tQuiz.testYourKnowledge}
      headerIcon={<HelpCircle className="w-4 h-4 text-brand-gold" />}
      phase={phase}
      qIdx={qIdx}
      questions={questions}
      answers={answers}
      result={result}
      score={score}
      total={total}
      pct={pct}
      passed={passed}
      selected={selected}
      submitting={submitting}
      error={error}
      tQuiz={tQuiz}
      lang={lang}
      getQuestion={getQuestion}
      getOptionText={getOptionText}
      inputNamePrefix={`q-${lessonId}`}
      onAnswerSelect={(qId, opt) => setAnswers(prev => ({ ...prev, [qId]: opt }))}
      onNext={handleNext}
      onRetry={handleRetry}
      onNextLesson={onNextLesson}
    />
  )
}

// ── Chapter quiz: fetches 5 random questions from API ────────────────────────
function ChapterQuizPlayer({ chapterId, chapterTitle, bestSubmission, alreadyPassed, lang, tQuiz, onPassed, onNextLesson }: {
  chapterId: number
  chapterTitle: string
  bestSubmission: QuizSubmission | null
  alreadyPassed: boolean
  lang: string
  tQuiz: typeof import('@/lib/translations').translations.en.quiz
  onPassed: (chapterId: number) => void
  onNextLesson: (() => void) | null
}) {
  type Phase = 'loading' | 'question' | 'result' | 'error'
  const [phase, setPhase] = useState<Phase>(alreadyPassed ? 'result' : 'loading')
  const [questions, setQuestions] = useState<QuizQuestion_Public[]>([])
  const [loadError, setLoadError] = useState('')
  const [qIdx, setQIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, 'a' | 'b' | 'c' | 'd'>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (alreadyPassed) return
    fetch(`/api/quiz/chapter/${chapterId}`)
      .then(r => r.json())
      .then(data => {
        if (data.questions?.length > 0) {
          setQuestions(data.questions)
          setPhase('question')
        } else {
          setLoadError(data.error || 'No questions available for this chapter')
          setPhase('error')
        }
      })
      .catch(() => { setLoadError('Failed to load quiz questions'); setPhase('error') })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId])

  const OPTIONS: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd']
  const question = questions[qIdx]
  const selected = question ? answers[question.id] : undefined
  const isLast = qIdx === questions.length - 1

  function getOptionText(q: QuizQuestion_Public, opt: 'a' | 'b' | 'c' | 'd') {
    const te = q[`option_${opt}_te` as keyof QuizQuestion_Public] as string | undefined
    const en = q[`option_${opt}_en` as keyof QuizQuestion_Public] as string
    return lang === 'te' && te ? te : en
  }

  function getQuestion(q: QuizQuestion_Public) {
    return lang === 'te' && q.question_te ? q.question_te : q.question_en
  }

  async function handleNext() {
    if (!selected) return
    if (!isLast) { setQIdx(i => i + 1); return }
    setSubmitError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/quiz/chapter/${chapterId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({} as { error?: string }))
        setSubmitError(d.error || 'Submission failed')
        return
      }
      const data: QuizResult = await res.json()
      setResult(data)
      setPhase('result')
      if (data.score >= CHAPTER_QUIZ_PASS_SCORE) onPassed(chapterId)
    } finally {
      setSubmitting(false)
    }
  }

  function handleRetry() {
    setAnswers({})
    setQIdx(0)
    setResult(null)
    setSubmitError('')
    // Re-fetch fresh random questions
    setPhase('loading')
    fetch(`/api/quiz/chapter/${chapterId}`)
      .then(r => r.json())
      .then(data => {
        if (data.questions?.length > 0) { setQuestions(data.questions); setPhase('question') }
        else { setLoadError(data.error || 'No questions available'); setPhase('error') }
      })
      .catch(() => { setLoadError('Failed to load quiz questions'); setPhase('error') })
  }

  const score = result?.score ?? bestSubmission?.score ?? 0
  const total = result?.total ?? bestSubmission?.total_questions ?? questions.length
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const passed = score >= CHAPTER_QUIZ_PASS_SCORE
  const scoreMessage = getChapterQuizMessage(score, lang)

  if (phase === 'loading') {
    return (
      <div className="border-b border-brand-border bg-brand-card/50">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border/50">
          <Layers className="w-4 h-4 text-brand-gold" />
          <span className="text-brand-gold font-semibold text-sm">Chapter Quiz — {chapterTitle}</span>
        </div>
        <div className="flex items-center justify-center gap-2 py-12 text-brand-gold-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading questions…
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="border-b border-brand-border bg-brand-card/50">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border/50">
          <Layers className="w-4 h-4 text-brand-gold" />
          <span className="text-brand-gold font-semibold text-sm">Chapter Quiz — {chapterTitle}</span>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-brand-error text-sm">{loadError}</p>
          {onNextLesson && (
            <button onClick={onNextLesson} className="mt-4 flex items-center gap-1 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors mx-auto">
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <QuizShell
      header={`Chapter Quiz — ${chapterTitle}`}
      headerIcon={<Layers className="w-4 h-4 text-brand-gold" />}
      phase={phase}
      qIdx={qIdx}
      questions={questions}
      answers={answers}
      result={result}
      score={score}
      total={total}
      pct={pct}
      passed={passed}
      scoreMessage={scoreMessage}
      selected={selected}
      submitting={submitting}
      error={submitError}
      tQuiz={tQuiz}
      lang={lang}
      getQuestion={getQuestion}
      getOptionText={getOptionText}
      inputNamePrefix={`cq-${chapterId}`}
      onAnswerSelect={(qId, opt) => setAnswers(prev => ({ ...prev, [qId]: opt }))}
      onNext={handleNext}
      onRetry={handleRetry}
      onNextLesson={onNextLesson}
    />
  )
}

// ── Shared quiz shell UI ──────────────────────────────────────────────────────
function QuizShell({
  header, headerIcon, phase, qIdx, questions, answers, result,
  score, total, pct, passed, scoreMessage, selected, submitting, error,
  tQuiz, lang: _lang, getQuestion, getOptionText, inputNamePrefix,
  onAnswerSelect, onNext, onRetry, onNextLesson,
}: {
  header: string
  headerIcon: React.ReactNode
  phase: 'question' | 'result'
  qIdx: number
  questions: QuizQuestion_Public[]
  answers: Record<number, 'a' | 'b' | 'c' | 'd'>
  result: QuizResult | null
  score: number; total: number; pct: number; passed: boolean
  scoreMessage?: string
  selected: 'a' | 'b' | 'c' | 'd' | undefined
  submitting: boolean
  error: string
  tQuiz: typeof import('@/lib/translations').translations.en.quiz
  lang: string
  getQuestion: (q: QuizQuestion_Public) => string
  getOptionText: (q: QuizQuestion_Public, opt: 'a' | 'b' | 'c' | 'd') => string
  inputNamePrefix: string
  onAnswerSelect: (qId: number, opt: 'a' | 'b' | 'c' | 'd') => void
  onNext: () => void
  onRetry: () => void
  onNextLesson: (() => void) | null
}) {
  const OPTIONS: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd']
  const question = questions[qIdx]
  const isLast = qIdx === questions.length - 1

  return (
    <div className="border-b border-brand-border bg-brand-card/50">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border/50">
        {headerIcon}
        <span className="text-brand-gold font-semibold text-sm">{header}</span>
        {phase === 'question' && (
          <span className="text-brand-gold-muted text-xs ml-auto">
            {tQuiz.question} {qIdx + 1} {tQuiz.questionOf} {questions.length}
          </span>
        )}
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto w-full">
        {phase === 'result' ? (
          <div className={`rounded-xl border p-6 text-center ${
            passed ? 'border-brand-success/40 bg-brand-success/10' : 'border-brand-error/40 bg-brand-error/10'
          }`}>
            <p className="text-brand-gold-muted text-[11px] font-semibold uppercase tracking-wider mb-2">{tQuiz.scorecard}</p>
            <div className={`text-4xl font-bold ${passed ? 'text-brand-success' : 'text-brand-error'}`}>
              {score}/{total}
            </div>
            <p className="text-brand-gold-muted text-xs mt-1">{tQuiz.yourScore} · {pct}%</p>

            {passed ? (
              <>
                <p className="flex items-center justify-center gap-1.5 text-brand-success text-sm font-semibold mt-4">
                  <CheckCircle2 className="w-4 h-4" />
                  {scoreMessage ?? tQuiz.quizPassed}
                </p>
                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  {onNextLesson && (
                    <button onClick={onNextLesson} className="flex items-center gap-1 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
                      {tQuiz.nextLesson}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={onRetry} className="px-4 py-2 border border-brand-gold text-brand-gold text-sm rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors">
                    {tQuiz.retakeQuiz}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-brand-error text-sm font-semibold mt-4">{scoreMessage ?? tQuiz.quizFailed}</p>
                {!scoreMessage && <p className="text-brand-gold-muted text-xs mt-1">{tQuiz.needToPass}</p>}
                <button onClick={onRetry} className="mt-4 px-5 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
                  {tQuiz.retry}
                </button>
              </>
            )}
          </div>
        ) : question ? (
          <>
            <div className="h-1 bg-brand-border rounded-full overflow-hidden mb-5">
              <div className="h-full bg-brand-gold rounded-full transition-all duration-300" style={{ width: `${(qIdx / questions.length) * 100}%` }} />
            </div>

            {error && <p className="text-brand-error text-xs mb-3">{error}</p>}

            <p className="text-brand-body text-sm font-medium mb-4">
              <span className="text-brand-gold-muted mr-1">{qIdx + 1}.</span>
              {getQuestion(question)}
            </p>

            <div className="space-y-2">
              {OPTIONS.map(opt => (
                <label key={opt} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                  answers[question.id] === opt
                    ? 'bg-brand-gold/10 border border-brand-gold text-brand-gold'
                    : 'border border-brand-border text-brand-body hover:border-brand-gold/50'
                }`}>
                  <input type="radio" name={`${inputNamePrefix}-${question.id}`} value={opt}
                    checked={answers[question.id] === opt}
                    onChange={() => onAnswerSelect(question.id, opt)}
                    className="sr-only" />
                  <span className="font-semibold uppercase w-4 flex-shrink-0">{opt}</span>
                  <span>{getOptionText(question, opt)}</span>
                </label>
              ))}
            </div>

            {selected && (
              <button onClick={onNext} disabled={submitting}
                className="mt-5 w-full flex items-center justify-center gap-1 py-2.5 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? tQuiz.submitting : isLast ? tQuiz.viewScore : tQuiz.next}
                {!submitting && !isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}

// ── Sidebar lesson list ───────────────────────────────────────────────────────
function LessonList({
  lessons, currentIdx, completedIds, lang, onSelect, sidebarRef, quizCounts, passedQuizIds, viewingQuiz, onSelectQuiz, tQuiz,
  chapterQuestionCounts, passedChapterQuizIds, activeChapterId, onSelectChapterQuiz,
}: {
  lessons: Lesson[]
  currentIdx: number
  completedIds: Set<number>
  lang: string
  onSelect: (i: number) => void
  sidebarRef: React.RefObject<HTMLDivElement> | undefined
  quizCounts: Record<number, number>
  passedQuizIds: Set<number>
  viewingQuiz: boolean
  onSelectQuiz: (i: number) => void
  tQuiz: typeof import('@/lib/translations').translations.en.quiz
  chapterQuestionCounts: Record<number, number>
  passedChapterQuizIds: Set<number>
  activeChapterId: number | null
  onSelectChapterQuiz: (chapterId: number) => void
}) {
  // Determine which lessons are the last in their chapter
  const lastInChapter = new Set<number>()
  const chapterLessonMap: Record<number, Lesson[]> = {}
  for (const l of lessons) {
    if (l.chapter_id) {
      if (!chapterLessonMap[l.chapter_id]) chapterLessonMap[l.chapter_id] = []
      chapterLessonMap[l.chapter_id].push(l)
    }
  }
  for (const chLessons of Object.values(chapterLessonMap)) {
    const maxOrder = Math.max(...chLessons.map(l => l.order_index))
    const lastLesson = chLessons.find(l => l.order_index === maxOrder)
    if (lastLesson) lastInChapter.add(lastLesson.id)
  }

  return (
    <div ref={sidebarRef} className="flex flex-col py-2">
      {lessons.map((lesson, idx) => {
        const showSection = lesson.section_title && lesson.section_title !== lessons[idx - 1]?.section_title
        const isActive = idx === currentIdx && !viewingQuiz && activeChapterId === null
        const isQuizActive = idx === currentIdx && viewingQuiz
        const isDone = completedIds.has(lesson.id)
        const quizCount = quizCounts[lesson.id] || 0
        const quizPassed = passedQuizIds.has(lesson.id)
        const lessonTitle = lang === 'te' && lesson.title_te ? lesson.title_te : lesson.title_en

        // Chapter quiz row: show after last lesson of a chapter if chapter has questions
        const showChapterQuiz = lastInChapter.has(lesson.id) && lesson.chapter_id && (chapterQuestionCounts[lesson.chapter_id] || 0) > 0
        const chapterQuizActive = showChapterQuiz && activeChapterId === lesson.chapter_id
        const chapterQuizPassed = lesson.chapter_id ? passedChapterQuizIds.has(lesson.chapter_id) : false

        return (
          <Fragment key={lesson.id}>
            {showSection && (
              <div className="px-4 pt-4 pb-1 text-brand-gold-muted text-[11px] font-semibold uppercase tracking-wider">
                {lesson.section_title}
              </div>
            )}
            <button
              data-active={isActive}
              onClick={() => onSelect(idx)}
              className={`flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                isActive ? 'bg-brand-gold/10 border-r-2 border-brand-gold' : 'hover:bg-brand-gold/5'
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-brand-success" />
                ) : isActive ? (
                  <div className="w-4 h-4 rounded-full border-2 border-brand-gold bg-brand-gold/20" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-brand-border" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${
                  isActive ? 'text-brand-gold font-medium' : isDone ? 'text-brand-gold-muted' : 'text-brand-body'
                }`}>
                  <span className="text-brand-gold-muted text-xs mr-1">{idx + 1}.</span>
                  {lessonTitle}
                </p>
                {lesson.duration && <p className="text-brand-gold-muted text-xs mt-0.5">{lesson.duration}</p>}
              </div>
            </button>

            {/* Lesson quiz entry, nested under its lesson */}
            {quizCount > 0 && (
              <button
                data-active={isQuizActive}
                onClick={() => onSelectQuiz(idx)}
                className={`flex items-start gap-3 pl-9 pr-4 py-2.5 text-left transition-colors ${
                  isQuizActive ? 'bg-brand-gold/10 border-r-2 border-brand-gold' : 'hover:bg-brand-gold/5'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {quizPassed ? (
                    <CheckCircle2 className="w-4 h-4 text-brand-success" />
                  ) : isQuizActive ? (
                    <div className="w-4 h-4 rounded-full border-2 border-brand-gold bg-brand-gold/20" />
                  ) : (
                    <HelpCircle className="w-4 h-4 text-brand-gold-muted opacity-70" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${
                    isQuizActive ? 'text-brand-gold font-medium' : quizPassed ? 'text-brand-gold-muted' : 'text-brand-body'
                  }`}>
                    {tQuiz.testYourKnowledge}
                  </p>
                  <p className="text-brand-gold-muted text-xs mt-0.5">{quizCount} {tQuiz.questionsCount}</p>
                </div>
              </button>
            )}

            {/* Chapter quiz entry — shown after the last lesson of each chapter */}
            {showChapterQuiz && lesson.chapter_id && (
              <button
                data-active={chapterQuizActive}
                onClick={() => onSelectChapterQuiz(lesson.chapter_id!)}
                className={`flex items-start gap-3 pl-6 pr-4 py-2.5 text-left transition-colors border-t border-brand-border/30 ${
                  chapterQuizActive ? 'bg-brand-gold/10 border-r-2 border-brand-gold' : 'hover:bg-brand-gold/5'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {chapterQuizPassed ? (
                    <CheckCircle2 className="w-4 h-4 text-brand-success" />
                  ) : chapterQuizActive ? (
                    <div className="w-4 h-4 rounded-full border-2 border-brand-gold bg-brand-gold/20" />
                  ) : (
                    <Layers className="w-4 h-4 text-brand-gold opacity-70" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug font-medium ${
                    chapterQuizActive ? 'text-brand-gold' : chapterQuizPassed ? 'text-brand-gold-muted' : 'text-brand-gold'
                  }`}>
                    Chapter Quiz
                  </p>
                  <p className="text-brand-gold-muted text-xs mt-0.5">
                    {chapterQuizPassed ? 'Passed' : `5 random questions · ${chapterQuestionCounts[lesson.chapter_id]} in pool`}
                  </p>
                </div>
              </button>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function NotesPanel({ notes, status, placeholder, savingLabel, savedLabel, label, onChange }: {
  notes: string; status: 'idle' | 'saving' | 'saved'
  placeholder: string; savingLabel: string; savedLabel: string; label: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-brand-gold font-semibold text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {label}
        </span>
        {status === 'saving' && <span className="text-brand-gold-muted text-xs">{savingLabel}</span>}
        {status === 'saved' && <span className="text-brand-success text-xs">{savedLabel}</span>}
      </div>
      <textarea
        value={notes}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-h-[200px] lg:min-h-0 w-full bg-brand-bg border border-brand-border rounded-xl p-3 text-brand-body text-sm resize-none focus:outline-none focus:border-brand-gold transition-colors placeholder:text-brand-gold-muted"
      />
    </div>
  )
}
