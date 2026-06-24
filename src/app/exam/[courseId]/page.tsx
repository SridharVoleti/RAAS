'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, XCircle, Award, Clock, AlertCircle, ChevronRight } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import type { ExamQuestion_Public } from '@/types'

type Phase = 'loading' | 'landing' | 'cooldown' | 'active' | 'result'

interface SessionInfo {
  enrolled: boolean
  exam_only: boolean
  passed: boolean
  bestSession: { id: string; score: number; submitted_at: string } | null
  inProgress: boolean
  activeSession: { id: string; questions_answered: number; total_questions: number; current_difficulty: number } | null
  currentQuestion: (ExamQuestion_Public & { question_number: number }) | null
  cooldown: boolean
  nextAllowedAt: string | null
}

interface ActiveState {
  sessionId: string
  question: ExamQuestion_Public
  questionNumber: number
  totalQuestions: number
  selectedAnswer: 'a' | 'b' | 'c' | 'd' | null
  submitting: boolean
}

interface ResultState {
  score: number
  total: number
  passed: boolean
  sessionId: string
}

const DIFF_LABEL: Record<number, string> = { 1: 'Easy', 2: 'Medium', 3: 'Hard' }
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const

export default function ExamPage() {
  const { courseId } = useParams() as { courseId: string }
  const router = useRouter()
  const { lang } = useLang()

  const [phase, setPhase] = useState<Phase>('loading')
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [active, setActive] = useState<ActiveState | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)
  const [error, setError] = useState('')
  const [enrolling, setEnrolling] = useState(false)

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/exam/${courseId}/session`)
    if (!res.ok) {
      setError('Failed to load exam status.')
      setPhase('landing')
      return
    }
    const info: SessionInfo = await res.json()
    setSessionInfo(info)

    if (info.cooldown) {
      setPhase('cooldown')
    } else if (info.inProgress && info.currentQuestion) {
      setPhase('active')
      setActive({
        sessionId:      info.activeSession!.id,
        question:       info.currentQuestion,
        questionNumber: info.currentQuestion.question_number,
        totalQuestions: info.activeSession!.total_questions,
        selectedAnswer: null,
        submitting:     false,
      })
    } else {
      setPhase('landing')
    }
  }, [courseId])

  useEffect(() => { loadSession() }, [loadSession])

  async function handleExamOnlyEnroll() {
    setEnrolling(true)
    const res = await fetch('/api/enroll/exam-only', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: Number(courseId) }),
    })
    if (res.ok) {
      await loadSession()
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
      } else {
        setError(data.error || 'Failed to start exam')
      }
      return
    }

    setActive({
      sessionId:      data.session_id,
      question:       data.question,
      questionNumber: data.question_number,
      totalQuestions: data.total_questions,
      selectedAnswer: null,
      submitting:     false,
    })
    setPhase('active')
  }

  async function handleAnswer() {
    if (!active || !active.selectedAnswer || active.submitting) return
    setActive(a => a ? { ...a, submitting: true } : a)

    const res = await fetch(`/api/exam/${courseId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id:  active.sessionId,
        question_id: active.question.id,
        answer:      active.selectedAnswer,
      }),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to submit answer')
      setActive(a => a ? { ...a, submitting: false } : a)
      return
    }

    if (data.done) {
      setResult({ score: data.score, total: data.total, passed: data.passed, sessionId: data.session_id })
      setPhase('result')
    } else {
      setActive({
        sessionId:      active.sessionId,
        question:       data.question,
        questionNumber: data.question_number,
        totalQuestions: data.total_questions,
        selectedAnswer: null,
        submitting:     false,
      })
    }
  }

  function getOption(q: ExamQuestion_Public, opt: 'a' | 'b' | 'c' | 'd'): string {
    const enKey = `option_${opt}_en` as keyof ExamQuestion_Public
    const teKey = `option_${opt}_te` as keyof ExamQuestion_Public
    const teVal = q[teKey] as string | undefined
    return lang === 'te' && teVal ? teVal : q[enKey] as string
  }

  function getQuestion(q: ExamQuestion_Public): string {
    const teVal = q.question_te
    return lang === 'te' && teVal ? teVal : q.question_en
  }

  // ─── Loading ─────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-5xl animate-pulse">ॐ</div>
      </div>
    )
  }

  // ─── Cooldown ────────────────────────────────────────────
  if (phase === 'cooldown' && sessionInfo) {
    const nextAllowed = sessionInfo.nextAllowedAt ? new Date(sessionInfo.nextAllowedAt) : null
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-md w-full text-center">
          <Clock className="w-14 h-14 text-brand-gold mx-auto mb-4" />
          <h2 className="text-brand-gold font-bold text-xl mb-2">Cooldown Period</h2>
          <p className="text-brand-gold-muted text-sm mb-4">
            You may retake the exam after 48 hours from your last attempt.
          </p>
          {nextAllowed && (
            <div className="bg-brand-bg rounded-xl border border-brand-border px-4 py-3 mb-6">
              <p className="text-brand-gold-muted text-xs mb-1">Next attempt allowed after</p>
              <p className="text-brand-gold font-semibold">
                {nextAllowed.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' at '}
                {nextAllowed.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
          <button onClick={() => router.push('/my-courses')}
            className="px-6 py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors text-sm">
            Back to My Courses
          </button>
        </div>
      </div>
    )
  }

  // ─── Active exam ─────────────────────────────────────────
  if (phase === 'active' && active) {
    const pct = Math.round(((active.questionNumber - 1) / active.totalQuestions) * 100)

    return (
      <div className="min-h-screen bg-brand-bg">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-brand-card border-b border-brand-border px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-brand-gold-muted text-xs">
                Question {active.questionNumber} of {active.totalQuestions}
              </span>
              <span className="text-brand-gold-muted text-xs">
                {DIFF_LABEL[(active.question as ExamQuestion_Public & { difficulty: number }).difficulty] ?? ''}
              </span>
            </div>
            <div className="h-1.5 bg-brand-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-gold rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="max-w-2xl mx-auto px-4 py-8">
          {error && (
            <div className="flex items-center gap-2 bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-6 text-brand-error text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
            <p className="text-brand-body text-base leading-relaxed font-medium">
              {getQuestion(active.question)}
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {(['a', 'b', 'c', 'd'] as const).map((opt, i) => {
              const isSelected = active.selectedAnswer === opt
              return (
                <button
                  key={opt}
                  onClick={() => !active.submitting && setActive(a => a ? { ...a, selectedAnswer: opt } : a)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all ${
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
                  <span className="text-sm leading-relaxed">{getOption(active.question, opt)}</span>
                </button>
              )
            })}
          </div>

          <button
            onClick={handleAnswer}
            disabled={!active.selectedAnswer || active.submitting}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {active.submitting ? 'Submitting…' : active.questionNumber === active.totalQuestions ? 'Submit Exam' : (
              <>Next <ChevronRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-brand-gold-muted text-xs mt-4">
            You cannot go back to a previous question. Choose carefully.
          </p>
        </div>
      </div>
    )
  }

  // ─── Result ──────────────────────────────────────────────
  if (phase === 'result' && result) {
    const pct = Math.round((result.score / result.total) * 100)
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-8">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-md w-full text-center">
          {result.passed ? (
            <>
              <CheckCircle className="w-16 h-16 text-brand-success mx-auto mb-4" />
              <div className="text-brand-gold text-5xl font-bold mb-1">{pct}%</div>
              <div className="text-brand-success font-semibold text-lg mb-2">Passed!</div>
              <p className="text-brand-gold-muted text-sm mb-1">
                {result.score} out of {result.total} correct
              </p>
              <p className="text-brand-gold-muted text-sm mb-6">Minimum required: 70%</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => router.push(`/certificate/${courseId}`)}
                  className="flex items-center justify-center gap-2 py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
                >
                  <Award className="w-5 h-5" />
                  Download Certificate
                </button>
                <button
                  onClick={() => router.push('/my-courses')}
                  className="py-2.5 border border-brand-border text-brand-gold-muted rounded-xl hover:text-brand-gold hover:border-brand-gold transition-colors text-sm"
                >
                  Back to My Courses
                </button>
              </div>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-brand-error mx-auto mb-4" />
              <div className="text-brand-gold text-5xl font-bold mb-1">{pct}%</div>
              <div className="text-brand-error font-semibold text-lg mb-2">Not Passed</div>
              <p className="text-brand-gold-muted text-sm mb-1">
                {result.score} out of {result.total} correct
              </p>
              <p className="text-brand-gold-muted text-sm mb-6">
                You need 70% (42/60) to pass. You may retake after 48 hours.
              </p>
              <button
                onClick={() => router.push('/my-courses')}
                className="w-full py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
              >
                Back to My Courses
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ─── Landing ─────────────────────────────────────────────
  const info = sessionInfo

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-8">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <span className="text-5xl">📜</span>
          <h1 className="text-brand-gold font-bold text-2xl mt-3 mb-1">Certification Exam</h1>
          <p className="text-brand-gold-muted text-sm">
            60 adaptive questions · 70% to pass · 48h cooldown on failure
          </p>
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
              <p className="text-brand-success text-sm font-semibold">You already passed this exam!</p>
              <p className="text-brand-gold-muted text-xs">
                Score: {info.bestSession.score}/60 ({Math.round((info.bestSession.score / 60) * 100)}%)
              </p>
            </div>
          </div>
        )}

        {/* Exam details */}
        <div className="space-y-3 mb-6">
          {[
            { label: 'Questions', value: '60 (adaptive difficulty)' },
            { label: 'Pass mark', value: '70% — 42 correct out of 60' },
            { label: 'Navigation', value: 'One question at a time — no going back' },
            { label: 'Retakes', value: 'Unlimited — 48h cooldown after failure' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-brand-gold mt-1.5 shrink-0" />
              <span className="text-brand-body text-sm"><strong className="text-brand-gold">{label}:</strong> {value}</span>
            </div>
          ))}
        </div>

        {!info?.enrolled ? (
          <div className="space-y-3">
            <button
              onClick={handleExamOnlyEnroll}
              disabled={enrolling}
              className="w-full py-3.5 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-50"
            >
              {enrolling ? 'Enrolling…' : 'Enroll & Take Exam'}
            </button>
            <p className="text-center text-brand-gold-muted text-xs">
              Already studying this course?{' '}
              <Link href="/login" className="text-brand-gold hover:underline">Log in</Link> to access your progress.
            </p>
          </div>
        ) : (
          <button
            onClick={handleStart}
            className="w-full py-3.5 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2"
          >
            {info?.passed ? 'Retake Exam' : 'Start Exam'}
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => router.push('/my-courses')}
          className="w-full mt-3 py-2.5 text-brand-gold-muted hover:text-brand-gold transition-colors text-sm"
        >
          ← Back to My Courses
        </button>
      </div>
    </div>
  )
}
