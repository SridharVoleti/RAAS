'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Award, Clock, AlertCircle, ChevronRight, BookOpen, GraduationCap } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import StarRatingInput from '@/components/StarRatingInput'
import type { ExamQuestionPage, ExamQuestion_Public } from '@/types'

type Phase = 'loading' | 'landing' | 'cooldown' | 'blocked' | 'active' | 'result'

interface SessionInfo {
  enrolled: boolean
  exam_only: boolean
  passed: boolean
  bestSession: { id: string; score: number; total: number | null; submitted_at: string } | null
  inProgress: boolean
  activeSession: { id: string; questions_answered: number; total_questions: number; expires_at: string | null } | null
  currentPage: ExamQuestionPage | null
  cooldown: boolean
  nextAllowedAt: string | null
  mustTakeCourse: boolean
  questionCount: number
  maxAttempts: number | null
  attemptsUsed: number | null
  attemptsRemaining: number | null
}

interface ActiveState {
  sessionId: string
  page: ExamQuestionPage
  selected: Record<number, 'a' | 'b' | 'c' | 'd'>
  submitting: boolean
}

interface ResultState {
  score: number
  total: number
  passed: boolean
  expired: boolean
  mustTakeCourse: boolean
  examOnly: boolean
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

export default function ExamPage() {
  const { courseId } = useParams() as { courseId: string }
  const router = useRouter()
  const { t } = useLang()
  const tx = t.exam

  const [phase, setPhase] = useState<Phase>('loading')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [active, setActive] = useState<ActiveState | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)
  const [error, setError] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [ratingSaved, setRatingSaved] = useState(false)

  useEffect(() => {
    if (phase !== 'result' || !result?.passed) return
    fetch(`/api/course-ratings/${courseId}`)
      .then(r => r.json())
      .then((d: { rating: number | null }) => {
        if (d.rating) { setMyRating(d.rating); setRatingSaved(true) }
      })
      .catch(() => {})
  }, [phase, result?.passed, courseId])

  async function submitRating(rating: number) {
    setMyRating(rating)
    try {
      const res = await fetch(`/api/course-ratings/${courseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      if (res.ok) setRatingSaved(true)
    } catch {}
  }

  // Prior-learning declaration form
  const [guruName, setGuruName] = useState('')
  const [guruMobile, setGuruMobile] = useState('')
  const [bookName, setBookName] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  // Countdown timer
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const expiryHandled = useRef(false)

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/exam/${courseId}/session`)
    if (!res.ok) {
      setError('Failed to load exam status.')
      setPhase('landing')
      return
    }
    const info: SessionInfo = await res.json()
    setSessionInfo(info)

    if (info.mustTakeCourse) {
      setPhase('blocked')
    } else if (info.cooldown) {
      setPhase('cooldown')
    } else if (info.inProgress && info.currentPage) {
      setActive({
        sessionId:  info.activeSession!.id,
        page:       info.currentPage,
        selected:   {},
        submitting: false,
      })
      setPhase('active')
    } else {
      setPhase('landing')
    }
  }, [courseId])

  useEffect(() => { loadSession() }, [loadSession])

  // Tick the countdown while a timed page is active
  const expiresAt = active?.page.expires_at ?? null
  useEffect(() => {
    if (phase !== 'active' || !expiresAt) {
      setSecondsLeft(null)
      return
    }
    expiryHandled.current = false
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left <= 0 && !expiryHandled.current) {
        expiryHandled.current = true
        void submitPage(true)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, expiresAt])

  async function handleExamOnlyEnroll() {
    setError('')
    setEnrolling(true)
    const res = await fetch('/api/enroll/exam-only', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId:      Number(courseId),
        teacherName:   guruName.trim(),
        teacherMobile: guruMobile.trim(),
        bookName:      bookName.trim(),
      }),
    })
    if (res.ok) {
      await handleStart()
    } else {
      const d = await res.json()
      setError(d.error || 'Enrollment failed')
    }
    setEnrolling(false)
  }

  async function handleStart() {
    setError('')
    const res = await fetch(`/api/exam/${courseId}/start`, { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      if (data.error === 'cooldown') {
        setSessionInfo(prev => prev ? { ...prev, cooldown: true, nextAllowedAt: data.nextAllowedAt } : prev)
        setPhase('cooldown')
      } else if (data.error === 'must_take_course') {
        setPhase('blocked')
      } else {
        setError(data.error || 'Failed to start exam')
      }
      return
    }

    const { session_id, ...page } = data
    setActive({ sessionId: session_id, page: page as ExamQuestionPage, selected: {}, submitting: false })
    setPhase('active')
  }

  async function submitPage(fromExpiry = false) {
    setActive(a => {
      if (!a || a.submitting) return a
      return { ...a, submitting: true }
    })

    // Read latest state via functional update pattern is awkward here; rely on closure
    // being fresh because submitPage is only called from current render's handlers.
    const current = activeRef.current
    if (!current) return

    const answers = current.page.questions
      .filter(q => current.selected[q.id])
      .map(q => ({ question_id: q.id, answer: current.selected[q.id] }))

    if (!fromExpiry && answers.length < current.page.questions.length) {
      setError(tx.answerAll)
      setActive(a => a ? { ...a, submitting: false } : a)
      return
    }

    setError('')
    const res = await fetch(`/api/exam/${courseId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: current.sessionId,
        // On expiry the server ignores these and grades what was already saved
        answers: fromExpiry ? [] : answers,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to submit answers')
      setActive(a => a ? { ...a, submitting: false } : a)
      return
    }

    if (data.done) {
      setResult({
        score:          data.score,
        total:          data.total,
        passed:         data.passed,
        expired:        !!data.expired,
        mustTakeCourse: !!data.must_take_course,
        examOnly:       !!data.exam_only,
      })
      setPhase('result')
    } else {
      setActive({
        sessionId:  current.sessionId,
        page:       data as ExamQuestionPage,
        selected:   {},
        submitting: false,
      })
      window.scrollTo({ top: 0 })
    }
  }

  // Keep a ref in sync so the timer callback sees the latest answers
  const activeRef = useRef<ActiveState | null>(null)
  activeRef.current = active

  function getOption(q: ExamQuestion_Public, opt: 'a' | 'b' | 'c' | 'd'): string {
    return q[`option_${opt}_te`] || ''
  }

  function getQuestion(q: ExamQuestion_Public): string {
    return q.question_te || ''
  }

  // ─── Loading ─────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-5xl animate-pulse">ॐ</div>
      </div>
    )
  }

  // ─── Blocked: attempts exhausted, must take the course ───
  if (phase === 'blocked') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-md w-full text-center">
          <BookOpen className="w-14 h-14 text-brand-gold mx-auto mb-4" />
          <h2 className="text-brand-gold font-bold text-xl mb-3">{tx.mustTakeCourseTitle}</h2>
          <p className="text-brand-gold-muted text-sm leading-relaxed mb-6">{tx.mustTakeCourseBody}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push(`/payment/${courseId}`)}
              className="flex items-center justify-center gap-2 py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
            >
              <GraduationCap className="w-5 h-5" />
              {tx.takeCourse}
            </button>
            <button
              onClick={() => router.push('/my-courses')}
              className="py-2.5 border border-brand-border text-brand-gold-muted rounded-xl hover:text-brand-gold hover:border-brand-gold transition-colors text-sm"
            >
              {tx.backToMyCourses}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Cooldown (regular course students) ──────────────────
  if (phase === 'cooldown' && sessionInfo) {
    const nextAllowed = sessionInfo.nextAllowedAt ? new Date(sessionInfo.nextAllowedAt) : null
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-md w-full text-center">
          <Clock className="w-14 h-14 text-brand-gold mx-auto mb-4" />
          <h2 className="text-brand-gold font-bold text-xl mb-2">{tx.cooldownTitle}</h2>
          <p className="text-brand-gold-muted text-sm mb-4">{tx.cooldownBody}</p>
          {nextAllowed && (
            <div className="bg-brand-bg rounded-xl border border-brand-border px-4 py-3 mb-6">
              <p className="text-brand-gold-muted text-xs mb-1">{tx.nextAttemptAfter}</p>
              <p className="text-brand-gold font-semibold">
                {nextAllowed.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' at '}
                {nextAllowed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
          <button onClick={() => router.push('/my-courses')}
            className="px-6 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm">
            {tx.backToMyCourses}
          </button>
        </div>
      </div>
    )
  }

  // ─── Active exam: 10 questions per page ──────────────────
  if (phase === 'active' && active) {
    const { page } = active

    const from = page.question_offset + 1
    const to = page.question_offset + page.questions.length
    const pct = Math.round((page.question_offset / page.total_questions) * 100)
    const isLastPage = to >= page.total_questions
    const answeredCount = page.questions.filter(q => active.selected[q.id]).length
    const mins = secondsLeft !== null ? Math.floor(secondsLeft / 60) : null
    const secs = secondsLeft !== null ? secondsLeft % 60 : null

    return (
      <div className="min-h-screen bg-brand-bg">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-brand-card border-b border-brand-border px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-brand-gold-muted text-xs">
                {fill(tx.questionsRange, { from, to, total: page.total_questions })}
              </span>
              {secondsLeft !== null && (
                <span className={`flex items-center gap-1 text-xs font-semibold ${secondsLeft < 300 ? 'text-brand-error' : 'text-brand-gold'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  {tx.timeLeft}: {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </span>
              )}
            </div>
            <div className="h-1.5 bg-brand-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-gold rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-8">
          {error && (
            <div className="flex items-center gap-2 bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-6 text-brand-error text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-8 mb-8">
            {page.questions.map((q, qi) => (
              <div key={q.id}>
                <div className="bg-brand-card border border-brand-border rounded-2xl p-5 mb-3">
                  <p className="text-brand-body text-base leading-relaxed font-medium">
                    <span className="text-brand-gold font-semibold mr-2">{page.question_offset + qi + 1}.</span>
                    {getQuestion(q)}
                  </p>
                </div>
                <div className="space-y-2.5">
                  {(['a', 'b', 'c', 'd'] as const).map((opt, i) => {
                    const isSelected = active.selected[q.id] === opt
                    return (
                      <button
                        key={opt}
                        onClick={() => !active.submitting &&
                          setActive(a => a ? { ...a, selected: { ...a.selected, [q.id]: opt } } : a)}
                        className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                            : 'border-brand-border text-brand-body hover:border-brand-gold/40 hover:bg-brand-gold/5'
                        }`}
                      >
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                          isSelected ? 'border-brand-gold bg-brand-gold text-brand-bg' : 'border-brand-border text-brand-gold-muted'
                        }`}>
                          {OPTION_LABELS[i]}
                        </span>
                        <span className="text-sm leading-relaxed">{getOption(q, opt)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => submitPage()}
            disabled={answeredCount < page.questions.length || active.submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {active.submitting ? 'Submitting…' : isLastPage ? tx.submitExam : (
              <>{tx.submitPage} <ChevronRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-brand-gold-muted text-xs mt-4">{tx.noBack}</p>
        </div>
      </div>
    )
  }

  // ─── Result ──────────────────────────────────────────────
  if (phase === 'result' && result) {
    const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-8">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-md w-full text-center">
          {result.expired && (
            <div className="flex items-center gap-2 bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-5 text-brand-error text-sm text-left">
              <Clock className="w-4 h-4 shrink-0" />
              {tx.expiredMsg}
            </div>
          )}
          {result.passed ? (
            <>
              <CheckCircle className="w-16 h-16 text-brand-success mx-auto mb-4" />
              <div className="text-brand-gold text-5xl font-bold mb-1">{pct}%</div>
              <div className="text-brand-success font-semibold text-lg mb-2">{tx.passed}</div>
              <p className="text-brand-gold-muted text-sm mb-1">
                {fill(tx.correctOutOf, { score: result.score, total: result.total })}
              </p>
              <p className="text-brand-gold-muted text-sm mb-4">{tx.minRequired}</p>
              <div className="mb-6">
                <p className="text-brand-gold-muted text-xs mb-2">
                  {ratingSaved ? t.cert.rateSubmitted : t.cert.ratePrompt}
                </p>
                <div className="flex justify-center">
                  <StarRatingInput initialValue={myRating} onSubmit={submitRating} />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push(`/certificate/${courseId}`)}
                  className="flex items-center justify-center gap-2 py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
                >
                  <Award className="w-5 h-5" />
                  {tx.downloadCertificate}
                </button>
                <button
                  onClick={() => router.push('/my-courses')}
                  className="py-2.5 border border-brand-border text-brand-gold-muted rounded-xl hover:text-brand-gold hover:border-brand-gold transition-colors text-sm"
                >
                  {tx.backToMyCourses}
                </button>
              </div>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-brand-error mx-auto mb-4" />
              <div className="text-brand-gold text-5xl font-bold mb-1">{pct}%</div>
              <div className="text-brand-error font-semibold text-lg mb-2">{tx.notPassed}</div>
              <p className="text-brand-gold-muted text-sm mb-1">
                {fill(tx.correctOutOf, { score: result.score, total: result.total })}
              </p>
              <p className="text-brand-gold-muted text-sm mb-5">{tx.minRequired}</p>
              {result.mustTakeCourse ? (
                <>
                  <p className="text-brand-body text-sm leading-relaxed mb-6">{tx.mustTakeCourseBody}</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => router.push(`/payment/${courseId}`)}
                      className="flex items-center justify-center gap-2 py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
                    >
                      <GraduationCap className="w-5 h-5" />
                      {tx.takeCourse}
                    </button>
                    <button
                      onClick={() => router.push('/my-courses')}
                      className="py-2.5 border border-brand-border text-brand-gold-muted rounded-xl hover:text-brand-gold hover:border-brand-gold transition-colors text-sm"
                    >
                      {tx.backToMyCourses}
                    </button>
                  </div>
                </>
              ) : result.examOnly ? (
                <>
                  <p className="text-brand-gold-muted text-sm mb-6">{tx.attemptsRemainingBody}</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleStart}
                      className="flex items-center justify-center gap-2 py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
                    >
                      {tx.retryNow}
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => router.push('/my-courses')}
                      className="py-2.5 border border-brand-border text-brand-gold-muted rounded-xl hover:text-brand-gold hover:border-brand-gold transition-colors text-sm"
                    >
                      {tx.backToMyCourses}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-brand-gold-muted text-sm mb-6">{tx.cooldownBody}</p>
                  <button
                    onClick={() => router.push('/my-courses')}
                    className="w-full py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
                  >
                    {tx.backToMyCourses}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── Landing ─────────────────────────────────────────────
  const info = sessionInfo
  const isNewExternal = !info?.enrolled
  const isExamOnly = isNewExternal || !!info?.exam_only
  const questionCount = info?.questionCount || 100
  const maxAttempts = info?.maxAttempts ?? 2
  const attemptsUsed = info?.attemptsUsed ?? 0
  const attemptsRemaining = info?.attemptsRemaining ?? maxAttempts
  const formValid =
    guruName.trim().length > 0 &&
    /^\+?\d{7,15}$/.test(guruMobile.trim()) &&
    bookName.trim().length > 0

  const disclaimer = (
    <div className="bg-brand-bg border border-brand-gold/30 rounded-xl p-4 mb-5">
      <p className="text-brand-gold font-semibold text-sm mb-2 flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        {tx.disclaimerHeading}
      </p>
      <ul className="space-y-1.5">
        {[
          fill(tx.disclaimerQuestions, { count: questionCount }),
          tx.disclaimerPass,
          fill(tx.disclaimerAttempts, { max: maxAttempts }),
          tx.disclaimerFail,
        ].map((line, i) => (
          <li key={i} className="flex items-start gap-2 text-brand-body text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gold mt-1.5 shrink-0" />
            {line}
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-8">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <span className="text-5xl">📜</span>
          <h1 className="text-brand-gold font-bold text-2xl mt-3 mb-1">
            {isExamOnly ? tx.finalTestTitle : tx.title}
          </h1>
          {isExamOnly && <p className="text-brand-gold-muted text-sm">{tx.guruFormSub}</p>}
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-4 text-brand-error text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Best score badge */}
        {info?.passed && info.bestSession && (
          <div className="flex items-center gap-3 bg-brand-success/10 border border-brand-success/30 rounded-xl px-4 py-3 mb-5">
            <CheckCircle className="w-5 h-5 text-brand-success shrink-0" />
            <div>
              <p className="text-brand-success text-sm font-semibold">{tx.alreadyPassed}</p>
              {info.bestSession.total && (
                <p className="text-brand-gold-muted text-xs">
                  {fill(tx.correctOutOf, { score: info.bestSession.score, total: info.bestSession.total })}
                  {' '}({Math.round((info.bestSession.score / info.bestSession.total) * 100)}%)
                </p>
              )}
            </div>
          </div>
        )}

        {isExamOnly ? (
          <>
            {!info?.passed && (
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 mb-5 border ${
                attemptsRemaining <= 1
                  ? 'bg-brand-error/10 border-brand-error/30'
                  : 'bg-brand-gold/10 border-brand-gold/30'
              }`}>
                <AlertCircle className={`w-5 h-5 shrink-0 ${attemptsRemaining <= 1 ? 'text-brand-error' : 'text-brand-gold'}`} />
                <div>
                  <p className={`text-sm font-semibold ${attemptsRemaining <= 1 ? 'text-brand-error' : 'text-brand-gold'}`}>
                    {fill(tx.attemptsRemainingBanner, { remaining: attemptsRemaining, max: maxAttempts })}
                  </p>
                  {attemptsUsed > 0 && (
                    <p className="text-brand-gold-muted text-xs mt-0.5">{tx.lastAttemptWarning}</p>
                  )}
                </div>
              </div>
            )}

            {isNewExternal && (
              <div className="mb-5">
                <p className="text-brand-gold font-semibold text-sm mb-3">{tx.guruFormHeading}</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-brand-gold-muted text-xs mb-1">{tx.guruName}</label>
                    <input
                      type="text"
                      value={guruName}
                      onChange={e => setGuruName(e.target.value)}
                      maxLength={200}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-brand-body text-sm focus:border-brand-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-brand-gold-muted text-xs mb-1">{tx.guruMobile}</label>
                    <input
                      type="tel"
                      value={guruMobile}
                      onChange={e => setGuruMobile(e.target.value)}
                      maxLength={16}
                      placeholder="+919876543210"
                      className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-brand-body text-sm focus:border-brand-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-brand-gold-muted text-xs mb-1">{tx.bookName}</label>
                    <input
                      type="text"
                      value={bookName}
                      onChange={e => setBookName(e.target.value)}
                      maxLength={200}
                      className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-brand-body text-sm focus:border-brand-gold focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {disclaimer}

            <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={e => setAcknowledged(e.target.checked)}
                className="mt-0.5 accent-[#d4a017]"
              />
              <span className="text-brand-body text-sm">{tx.iUnderstand}</span>
            </label>

            {isNewExternal ? (
              <button
                onClick={handleExamOnlyEnroll}
                disabled={enrolling || !formValid || !acknowledged}
                className="w-full py-3.5 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enrolling ? 'Please wait…' : tx.registerFinalTest}
              </button>
            ) : (
              <button
                onClick={handleStart}
                disabled={!acknowledged}
                className="w-full py-3.5 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {tx.startExam}
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </>
        ) : (
          <>
            {/* Regular course student */}
            <div className="space-y-3 mb-6">
              {[
                tx.disclaimerPass,
                tx.cooldownBody,
                tx.noBack,
              ].map((line, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-brand-gold mt-1.5 shrink-0" />
                  <span className="text-brand-body text-sm">{line}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleStart}
              className="w-full py-3.5 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
            >
              {info?.passed ? tx.retakeExam : tx.startExam}
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        <button
          onClick={() => router.push('/my-courses')}
          className="w-full mt-3 py-2.5 text-brand-gold-muted hover:text-brand-gold transition-colors text-sm"
        >
          ← {tx.backToMyCourses}
        </button>
      </div>
    </div>
  )
}
