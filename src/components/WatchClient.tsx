'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { CheckCircle2, Circle, ChevronLeft, ChevronRight, BookOpen, FileText } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import type { Course, Lesson } from '@/types'

interface Props {
  course: Course
  lessons: Lesson[]
  completedLessonIds: number[]
  initialLessonIndex: number
}

type TabType = 'lessons' | 'notes'

export default function WatchClient({ course, lessons, completedLessonIds, initialLessonIndex }: Props) {
  const { lang, t } = useLang()
  const router = useRouter()
  const pathname = usePathname()
  const [currentIdx, setCurrentIdx] = useState(initialLessonIndex)
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set(completedLessonIds))
  const [activeTab, setActiveTab] = useState<TabType>('lessons')
  const [notes, setNotes] = useState('')
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [marking, setMarking] = useState(false)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const isFirstRender = useRef(true)

  const currentLesson = lessons[currentIdx]
  const completedCount = completedIds.size
  const totalLessons = lessons.length
  const progressPct = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0
  const isCurrentComplete = currentLesson ? completedIds.has(currentLesson.id) : false

  // Fetch notes on mount
  useEffect(() => {
    fetch(`/api/notes/${course.id}`)
      .then(r => r.json())
      .then((data: { content?: string }) => setNotes(data.content || ''))
      .catch(() => {})
  }, [course.id])

  // Sync URL when lesson changes (skip first render to avoid double-push)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    router.replace(`${pathname}?lesson=${currentIdx}`, { scroll: false })
  }, [currentIdx, pathname, router])

  // Scroll active lesson into view in sidebar
  useEffect(() => {
    const active = sidebarRef.current?.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentIdx])

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
        .then(() => {
          setNotesStatus('saved')
          setTimeout(() => setNotesStatus('idle'), 2000)
        })
        .catch(() => setNotesStatus('idle'))
    }, 1500)
  }

  async function handleMarkComplete() {
    if (!currentLesson || isCurrentComplete || marking) return
    setMarking(true)
    try {
      const res = await fetch(`/api/progress/${course.id}/lesson/${currentLesson.id}`, {
        method: 'POST',
      })
      if (res.ok) {
        setCompletedIds(prev => new Set([...prev, currentLesson.id]))
        // Auto-advance to next incomplete lesson
        if (currentIdx < lessons.length - 1) {
          setCurrentIdx(prev => prev + 1)
        }
      }
    } finally {
      setMarking(false)
    }
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
            <div
              className="h-full bg-brand-gold rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-brand-gold-muted text-xs whitespace-nowrap">
            {completedCount}/{totalLessons}
          </span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: video + controls */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Video */}
          <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
            <iframe
              key={currentLesson.youtube_video_id}
              src={`https://www.youtube.com/embed/${currentLesson.youtube_video_id}?rel=0&modestbranding=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
              title={title}
            />
          </div>

          {/* Lesson title + controls */}
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

              <button
                onClick={handleMarkComplete}
                disabled={isCurrentComplete || marking}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isCurrentComplete
                    ? 'bg-brand-success/20 text-brand-success border border-brand-success cursor-default'
                    : 'bg-brand-gold text-brand-bg hover:bg-yellow-400 disabled:opacity-70'
                }`}
              >
                {isCurrentComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {t.watch.markedComplete}
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4" />
                    {marking ? '...' : t.watch.markComplete}
                  </>
                )}
              </button>

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
                activeTab === 'lessons'
                  ? 'text-brand-gold border-b-2 border-brand-gold'
                  : 'text-brand-gold-muted'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              {t.watch.lessons}
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
                activeTab === 'notes'
                  ? 'text-brand-gold border-b-2 border-brand-gold'
                  : 'text-brand-gold-muted'
              }`}
            >
              <FileText className="w-4 h-4" />
              {t.watch.notes}
            </button>
          </div>

          {/* Mobile: lesson list or notes */}
          <div className="lg:hidden flex-1">
            {activeTab === 'lessons' && (
              <LessonList
                lessons={lessons}
                currentIdx={currentIdx}
                completedIds={completedIds}
                lang={lang}
                onSelect={setCurrentIdx}
                sidebarRef={undefined}
              />
            )}
            {activeTab === 'notes' && (
              <NotesPanel
                notes={notes}
                status={notesStatus}
                placeholder={t.watch.notesPlaceholder}
                savingLabel={t.watch.notesSaving}
                savedLabel={t.watch.notesSaved}
                label={t.watch.notes}
                onChange={handleNotesChange}
              />
            )}
          </div>

          {/* Desktop: notes always visible below controls */}
          <div className="hidden lg:block p-4 flex-1">
            <NotesPanel
              notes={notes}
              status={notesStatus}
              placeholder={t.watch.notesPlaceholder}
              savingLabel={t.watch.notesSaving}
              savedLabel={t.watch.notesSaved}
              label={t.watch.notes}
              onChange={handleNotesChange}
            />
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
              <div
                className="h-full bg-brand-gold rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <LessonList
            lessons={lessons}
            currentIdx={currentIdx}
            completedIds={completedIds}
            lang={lang}
            onSelect={setCurrentIdx}
            sidebarRef={sidebarRef}
          />
        </aside>
      </div>
    </div>
  )
}

function LessonList({
  lessons,
  currentIdx,
  completedIds,
  lang,
  onSelect,
  sidebarRef,
}: {
  lessons: Lesson[]
  currentIdx: number
  completedIds: Set<number>
  lang: string
  onSelect: (i: number) => void
  sidebarRef: React.RefObject<HTMLDivElement> | undefined
}) {
  return (
    <div ref={sidebarRef} className="flex flex-col py-2">
      {lessons.map((lesson, idx) => {
        const showSection =
          lesson.section_title && lesson.section_title !== lessons[idx - 1]?.section_title
        const isActive = idx === currentIdx
        const isDone = completedIds.has(lesson.id)
        const lessonTitle =
          lang === 'te' && lesson.title_te ? lesson.title_te : lesson.title_en

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
                isActive
                  ? 'bg-brand-gold/10 border-r-2 border-brand-gold'
                  : 'hover:bg-brand-gold/5'
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
                <p
                  className={`text-sm leading-snug ${
                    isActive ? 'text-brand-gold font-medium' : isDone ? 'text-brand-gold-muted' : 'text-brand-body'
                  }`}
                >
                  <span className="text-brand-gold-muted text-xs mr-1">{idx + 1}.</span>
                  {lessonTitle}
                </p>
                {lesson.duration && (
                  <p className="text-brand-gold-muted text-xs mt-0.5">{lesson.duration}</p>
                )}
              </div>
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}

function NotesPanel({
  notes,
  status,
  placeholder,
  savingLabel,
  savedLabel,
  label,
  onChange,
}: {
  notes: string
  status: 'idle' | 'saving' | 'saved'
  placeholder: string
  savingLabel: string
  savedLabel: string
  label: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-brand-gold font-semibold text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {label}
        </span>
        {status === 'saving' && (
          <span className="text-brand-gold-muted text-xs">{savingLabel}</span>
        )}
        {status === 'saved' && (
          <span className="text-brand-success text-xs">{savedLabel}</span>
        )}
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
