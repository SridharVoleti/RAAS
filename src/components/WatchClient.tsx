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
  destroy: () => void
}

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
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])
  useEffect(() => { completedIdsRef.current = completedIds }, [completedIds])
  useEffect(() => { markingRef.current = marking }, [marking])

  const currentLesson = lessons[currentIdx]
  const completedCount = completedIds.size
  const totalLessons = lessons.length
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0
  const isCurrentComplete = currentLesson ? completedIds.has(currentLesson.id) : false

  // Quiz data for the current lesson
  const currentQuizQuestions = quizQuestions.filter(q => q.lesson_id === currentLesson?.id)
  const currentSubmission = quizSubmissions.find(s => s.lesson_id === currentLesson?.id) ?? null

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
      playerRef.current.loadVideoById(currentLesson.youtube_video_id)
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
        if (currentIdxRef.current < lessons.length - 1) {
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

          {/* Video */}
          <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
            <div id="yt-player" className="absolute inset-0 w-full h-full" />
            <div className="absolute top-0 left-0 right-0 h-10 z-10" style={{ pointerEvents: 'all' }} />
            <div className="absolute bottom-0 right-0 w-24 h-10 z-10" style={{ pointerEvents: 'all' }} />
            {justCompleted && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-brand-success text-brand-bg text-sm font-semibold rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4" />
                {t.watch.lessonCompleted}
              </div>
            )}
          </div>

          {/* Lesson title + prev/next controls */}
          <div className="p-4 border-b border-brand-border">
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

          {/* ── Lesson quiz — inline, immediately below controls ── */}
          {currentQuizQuestions.length > 0 && (
            <LessonQuizSection
              key={currentLesson?.id}
              lessonId={currentLesson.id}
              questions={currentQuizQuestions}
              existingSubmission={currentSubmission}
              lang={lang}
              tQuiz={t.quiz}
            />
          )}

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
              <LessonList lessons={lessons} currentIdx={currentIdx} completedIds={completedIds} lang={lang} onSelect={setCurrentIdx} sidebarRef={undefined} />
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
            onSelect={setCurrentIdx}
            sidebarRef={sidebarRef}
            quizLessonIds={new Set(quizQuestions.map(q => q.lesson_id))}
          />
        </aside>
      </div>
    </div>
  )
}

// ── Inline quiz section shown immediately below the lesson controls ───────────
function LessonQuizSection({ lessonId, questions, existingSubmission, lang, tQuiz }: {
  lessonId: number
  questions: QuizQuestion_Public[]
  existingSubmission: QuizSubmission | null
  lang: string
  tQuiz: typeof import('@/lib/translations').translations.en.quiz
}) {
  type Phase = 'quiz' | 'result'
  const [phase, setPhase] = useState<Phase>(existingSubmission ? 'result' : 'quiz')
  const [answers, setAnswers] = useState<Record<number, 'a' | 'b' | 'c' | 'd'>>({})
  const [result, setResult] = useState<QuizResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const OPTIONS: Array<'a' | 'b' | 'c' | 'd'> = ['a', 'b', 'c', 'd']
  const allAnswered = questions.every(q => answers[q.id] !== undefined)

  function getOptionText(q: QuizQuestion_Public, opt: 'a' | 'b' | 'c' | 'd') {
    const te = q[`option_${opt}_te` as keyof QuizQuestion_Public] as string | undefined
    const en = q[`option_${opt}_en` as keyof QuizQuestion_Public] as string
    return lang === 'te' && te ? te : en
  }

  function getQuestion(q: QuizQuestion_Public) {
    return lang === 'te' && q.question_te ? q.question_te : q.question_en
  }

  async function handleSubmit() {
    if (!allAnswered) { setError(tQuiz.answerAll); return }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/quiz/lesson/${lessonId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Submission failed'); return }
      const data: QuizResult = await res.json()
      setResult(data)
      setPhase('result')
    } finally {
      setSubmitting(false)
    }
  }

  const score = result?.score ?? existingSubmission?.score ?? 0
  const total = result?.total ?? existingSubmission?.total_questions ?? questions.length
  const pct = total > 0 ? Math.round((score / total) * 100) : 0
  const passed = pct >= 60

  return (
    <div className="border-t border-b border-brand-border bg-brand-card/50">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border/50">
        <HelpCircle className="w-4 h-4 text-brand-gold" />
        <span className="text-brand-gold font-semibold text-sm">{tQuiz.title}</span>
        <span className="text-brand-gold-muted text-xs ml-1">· {questions.length} {tQuiz.questionsCount}</span>
        {phase === 'result' && (
          <span className={`ml-auto text-xs font-semibold ${passed ? 'text-brand-success' : 'text-brand-error'}`}>
            {score}/{total} ({pct}%)
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {phase === 'result' ? (
          <>
            {/* Score banner */}
            <div className={`rounded-xl p-4 text-center ${passed ? 'bg-brand-success/10 border border-brand-success/30' : 'bg-brand-error/10 border border-brand-error/30'}`}>
              <div className={`text-3xl font-bold ${passed ? 'text-brand-success' : 'text-brand-error'}`}>
                {score}/{total}
              </div>
              <p className="text-brand-gold-muted text-xs mt-1">{tQuiz.yourScore} · {pct}%</p>
              <button
                onClick={() => { setAnswers({}); setResult(null); setPhase('quiz'); setError('') }}
                className="mt-3 px-4 py-1.5 border border-brand-gold text-brand-gold text-xs rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors"
              >
                {tQuiz.retakeQuiz}
              </button>
            </div>

            {/* Per-question results (only after fresh submission, not for existing) */}
            {result && questions.map((q, idx) => {
              const qResult = result.results[q.id]
              const userAns = answers[q.id]
              return (
                <div key={q.id} className={`rounded-xl p-3 border ${qResult?.correct ? 'border-brand-success/40 bg-brand-success/5' : 'border-brand-error/40 bg-brand-error/5'}`}>
                  <p className="text-brand-body text-xs font-medium mb-2">
                    <span className="text-brand-gold-muted mr-1">{idx + 1}.</span>
                    {getQuestion(q)}
                  </p>
                  <div className="space-y-1">
                    {OPTIONS.map(opt => {
                      const isCorrect = qResult?.correct_option === opt
                      const isUserChoice = userAns === opt
                      return (
                        <div key={opt} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                          isCorrect
                            ? 'bg-brand-success/20 text-brand-success border border-brand-success/40'
                            : isUserChoice && !isCorrect
                            ? 'bg-brand-error/20 text-brand-error border border-brand-error/40'
                            : 'text-brand-gold-muted'
                        }`}>
                          <span className="font-semibold uppercase w-4 flex-shrink-0">{opt}</span>
                          <span>{getOptionText(q, opt)}</span>
                          {isCorrect && <CheckCircle2 className="w-3 h-3 ml-auto flex-shrink-0" />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {!result && existingSubmission && (
              <p className="text-brand-gold-muted text-xs text-center">
                {tQuiz.previousScore}: {existingSubmission.score}/{existingSubmission.total_questions}
              </p>
            )}
          </>
        ) : (
          <>
            {error && <p className="text-brand-error text-xs">{error}</p>}

            {questions.map((q, idx) => (
              <div key={q.id} className="border border-brand-border rounded-xl p-3">
                <p className="text-brand-body text-xs font-medium mb-2.5">
                  <span className="text-brand-gold-muted mr-1">{idx + 1}.</span>
                  {getQuestion(q)}
                </p>
                <div className="space-y-1.5">
                  {OPTIONS.map(opt => (
                    <label key={opt} className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                      answers[q.id] === opt
                        ? 'bg-brand-gold/10 border border-brand-gold text-brand-gold'
                        : 'border border-brand-border text-brand-body hover:border-brand-gold/50'
                    }`}>
                      <input type="radio" name={`q-${lessonId}-${q.id}`} value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                        className="sr-only" />
                      <span className="font-semibold uppercase w-4 flex-shrink-0">{opt}</span>
                      <span>{getOptionText(q, opt)}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={handleSubmit}
              disabled={submitting || !allAnswered}
              className="w-full py-2.5 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? tQuiz.submitting : tQuiz.submitQuiz}
            </button>
            {!allAnswered && (
              <p className="text-brand-gold-muted text-xs text-center">
                {questions.length - Object.keys(answers).length} question{questions.length - Object.keys(answers).length !== 1 ? 's' : ''} remaining
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function LessonList({
  lessons, currentIdx, completedIds, lang, onSelect, sidebarRef, quizLessonIds,
}: {
  lessons: Lesson[]
  currentIdx: number
  completedIds: Set<number>
  lang: string
  onSelect: (i: number) => void
  sidebarRef: React.RefObject<HTMLDivElement> | undefined
  quizLessonIds?: Set<number>
}) {
  return (
    <div ref={sidebarRef} className="flex flex-col py-2">
      {lessons.map((lesson, idx) => {
        const showSection = lesson.section_title && lesson.section_title !== lessons[idx - 1]?.section_title
        const isActive = idx === currentIdx
        const isDone = completedIds.has(lesson.id)
        const hasQuiz = quizLessonIds?.has(lesson.id)
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
                <div className="flex items-center gap-2 mt-0.5">
                  {lesson.duration && <p className="text-brand-gold-muted text-xs">{lesson.duration}</p>}
                  {hasQuiz && <HelpCircle className="w-3 h-3 text-brand-gold-muted opacity-70" />}
                </div>
              </div>
            </button>
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
