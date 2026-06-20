'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { CheckCircle2, ChevronLeft, ChevronRight, BookOpen, FileText, HelpCircle } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import type { Course, Lesson, QuizQuestion_Public, QuizSubmission, QuizResult } from '@/types'

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
  loadVideoById: (videoId: string) => void
  cueVideoById: (videoId: string) => void
  pauseVideo: () => void
  destroy: () => void
}

const QUIZ_PASS_PCT = 80

interface Props {
  course: Course
  lessons: Lesson[]
  completedLessonIds: number[]
  initialLessonIndex: number
  quizQuestions?: QuizQuestion_Public[]
  quizSubmissions?: QuizSubmission[]
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

export default function WatchClient({
  course, lessons, completedLessonIds, initialLessonIndex,
  quizQuestions = [], quizSubmissions = [],
}: Props) {
  const { lang, t } = useLang()
  const router = useRouter()
  const pathname = usePathname()
  const [currentIdx, setCurrentIdx] = useState(initialLessonIndex)
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set(completedLessonIds))
  const [viewingQuiz, setViewingQuiz] = useState(false)
  const [passedQuizIds, setPassedQuizIds] = useState<Set<number>>(() => new Set(
    quizSubmissions
      .filter(s => s.lesson_id !== undefined && s.total_questions > 0 && (s.score / s.total_questions) * 100 >= QUIZ_PASS_PCT)
      .map(s => s.lesson_id as number)
  ))
  const [activeTab, setActiveTab] = useState<TabType>('lessons')
  const [notes, setNotes] = useState('')
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [marking, setMarking] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
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
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])
  useEffect(() => { completedIdsRef.current = completedIds }, [completedIds])
  useEffect(() => { markingRef.current = marking }, [marking])
  useEffect(() => { viewingQuizRef.current = viewingQuiz }, [viewingQuiz])
  useEffect(() => { passedQuizIdsRef.current = passedQuizIds }, [passedQuizIds])

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

  function selectLesson(idx: number) {
    setCurrentIdx(idx)
    setViewingQuiz(false)
  }

  function selectQuiz(idx: number) {
    setCurrentIdx(idx)
    setViewingQuiz(true)
    if (playerReadyRef.current) playerRef.current?.pauseVideo()
  }

  function handleQuizPassed(lessonId: number) {
    setPassedQuizIds(prev => new Set([...prev, lessonId]))
  }

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
    loadYTScript(() => {
      playerRef.current = new window.YT.Player('yt-player', {
        videoId: lessons[initialLessonIndex]?.youtube_video_id,
        playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1, origin: window.location.origin },
        events: {
          onReady: () => { playerReadyRef.current = true },
          onStateChange: (e) => { if (e.data === 0) autoMarkComplete() },
        },
      })
    })
    return () => {
      playerRef.current?.destroy()
      playerRef.current = null
      playerReadyRef.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!currentLesson) return
    if (playerReadyRef.current && playerRef.current) {
      // Cue (don't autoplay) when the quiz panel is open over the player
      if (viewingQuizRef.current) playerRef.current.cueVideoById(currentLesson.youtube_video_id)
      else playerRef.current.loadVideoById(currentLesson.youtube_video_id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLesson?.youtube_video_id])

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
        const hasUnpassedQuiz = (quizCounts[lesson.id] || 0) > 0 && !passedQuizIdsRef.current.has(lesson.id)
        if (hasUnpassedQuiz) {
          setViewingQuiz(true)
        } else if (currentIdxRef.current < lessons.length - 1) {
          setCurrentIdx(prev => prev + 1)
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

          {/* Video (kept mounted but hidden while the quiz is open) */}
          <div className={`relative w-full bg-black ${viewingQuiz ? 'hidden' : ''}`} style={{ paddingBottom: viewingQuiz ? 0 : '56.25%' }}>
            <div id="yt-player" className="absolute inset-0 w-full h-full" />
            <div className="absolute top-0 left-0 right-0 h-10 z-10" style={{ pointerEvents: 'all' }} />
            <div className="absolute bottom-0 right-0 w-24 h-10 z-10" style={{ pointerEvents: 'all' }} />
          </div>

          {/* Quiz player — one MCQ at a time */}
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

          {/* Lesson title + prev/next controls */}
          <div className={`p-4 border-b border-brand-border ${viewingQuiz ? 'hidden' : ''}`}>
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
          />
        </aside>
      </div>
    </div>
  )
}

// ── Quiz player: one MCQ at a time, scorecard at the end ─────────────────────
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
    <div className="border-b border-brand-border bg-brand-card/50">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border/50">
        <HelpCircle className="w-4 h-4 text-brand-gold" />
        <span className="text-brand-gold font-semibold text-sm">{tQuiz.testYourKnowledge}</span>
        {phase === 'question' && (
          <span className="text-brand-gold-muted text-xs ml-auto">
            {tQuiz.question} {qIdx + 1} {tQuiz.questionOf} {questions.length}
          </span>
        )}
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto w-full">
        {phase === 'result' ? (
          /* ── Scorecard ── */
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
                  {tQuiz.quizPassed}
                </p>
                <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
                  {onNextLesson && (
                    <button
                      onClick={onNextLesson}
                      className="flex items-center gap-1 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                    >
                      {tQuiz.nextLesson}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 border border-brand-gold text-brand-gold text-sm rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors"
                  >
                    {tQuiz.retakeQuiz}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-brand-error text-sm font-semibold mt-4">{tQuiz.quizFailed}</p>
                <p className="text-brand-gold-muted text-xs mt-1">{tQuiz.needToPass}</p>
                <button
                  onClick={handleRetry}
                  className="mt-4 px-5 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                >
                  {tQuiz.retry}
                </button>
              </>
            )}
          </div>
        ) : (
          /* ── One question at a time ── */
          <>
            <div className="h-1 bg-brand-border rounded-full overflow-hidden mb-5">
              <div
                className="h-full bg-brand-gold rounded-full transition-all duration-300"
                style={{ width: `${(qIdx / questions.length) * 100}%` }}
              />
            </div>

            {error && <p className="text-brand-error text-xs mb-3">{error}</p>}

            <p className="text-brand-body text-sm font-medium mb-4">
              <span className="text-brand-gold-muted mr-1">{qIdx + 1}.</span>
              {getQuestion(question)}
            </p>

            <div className="space-y-2">
              {OPTIONS.map(opt => (
                <label key={opt} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                  selected === opt
                    ? 'bg-brand-gold/10 border border-brand-gold text-brand-gold'
                    : 'border border-brand-border text-brand-body hover:border-brand-gold/50'
                }`}>
                  <input type="radio" name={`q-${lessonId}-${question.id}`} value={opt}
                    checked={selected === opt}
                    onChange={() => setAnswers(prev => ({ ...prev, [question.id]: opt }))}
                    className="sr-only" />
                  <span className="font-semibold uppercase w-4 flex-shrink-0">{opt}</span>
                  <span>{getOptionText(question, opt)}</span>
                </label>
              ))}
            </div>

            {/* Next appears only after an answer is chosen */}
            {selected && (
              <button
                onClick={handleNext}
                disabled={submitting}
                className="mt-5 w-full flex items-center justify-center gap-1 py-2.5 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? tQuiz.submitting : isLast ? tQuiz.viewScore : tQuiz.next}
                {!submitting && !isLast && <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LessonList({
  lessons, currentIdx, completedIds, lang, onSelect, sidebarRef, quizCounts, passedQuizIds, viewingQuiz, onSelectQuiz, tQuiz,
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
}) {
  return (
    <div ref={sidebarRef} className="flex flex-col py-2">
      {lessons.map((lesson, idx) => {
        const showSection = lesson.section_title && lesson.section_title !== lessons[idx - 1]?.section_title
        const isActive = idx === currentIdx && !viewingQuiz
        const isQuizActive = idx === currentIdx && viewingQuiz
        const isDone = completedIds.has(lesson.id)
        const quizCount = quizCounts[lesson.id] || 0
        const quizPassed = passedQuizIds.has(lesson.id)
        const lessonTitle = lang === 'te' && lesson.title_te ? lesson.title_te : lesson.title_en
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

            {/* Quiz entry, nested under its lesson */}
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
