'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { RAMANUJA_GRANTHA_CONFIG } from '@/lib/priorLearningConfigs'
import type { PriorLearningExamQuestion_Public } from '@/types'

const CONFIG_MAP = {
  [RAMANUJA_GRANTHA_CONFIG.categoryKey]: RAMANUJA_GRANTHA_CONFIG,
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const
const PASS_THRESHOLD_PCT = 70

type Phase = 'loading' | 'landing' | 'active' | 'result'

interface SessionStatus {
  status: 'none' | 'in_progress' | 'submitted' | 'expired'
  session_id?: string
  expires_at?: string
  question?: PriorLearningExamQuestion_Public
  question_number?: number
  total_questions?: number
  score?: number
  total?: number
  passed?: boolean
  submitted_at?: string
  declaration?: { id: number; book_name: string }
}

interface ActiveState {
  sessionId: string
  question: PriorLearningExamQuestion_Public
  questionNumber: number
  totalQuestions: number
  expiresAt: Date
  selectedAnswer: 'a' | 'b' | 'c' | 'd' | null
  submitting: boolean
}

interface ResultState {
  score: number
  total: number
  passed: boolean
  expired: boolean
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PriorLearningExamPage() {
  const { categoryKey } = useParams() as { categoryKey: string }
  const router = useRouter()
  const { lang } = useLang()
  const te = lang === 'te'

  const [phase, setPhase]   = useState<Phase>('loading')
  const [active, setActive] = useState<ActiveState | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const config = CONFIG_MAP[categoryKey]
  const categoryName = config
    ? (te ? config.categoryName.te : config.categoryName.en)
    : categoryKey

  // ── Timer ──────────────────────────────────────────────────
  function startTimer(expiresAt: Date) {
    if (timerRef.current) clearInterval(timerRef.current)
    const tick = () => {
      const secs = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      setTimeLeft(secs)
      if (secs === 0) {
        clearInterval(timerRef.current!)
        handleTimerExpired()
      }
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  async function handleTimerExpired() {
    setActive(a => a ? { ...a, submitting: true } : a)
    const res = await fetch(`/api/prior-learning-exam/${categoryKey}/submit`, { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setResult({ score: data.score, total: data.total, passed: data.passed, expired: true })
      setPhase('result')
    }
  }

  // ── Load session on mount ──────────────────────────────────
  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/prior-learning-exam/${categoryKey}/session`)
    if (!res.ok) {
      if (res.status === 403) router.push('/exams')
      return
    }
    const data: SessionStatus = await res.json()
    setSessionStatus(data)

    if (data.status === 'in_progress' && data.question && data.session_id && data.expires_at) {
      const exp = new Date(data.expires_at)
      setActive({
        sessionId:      data.session_id,
        question:       data.question,
        questionNumber: data.question_number ?? 1,
        totalQuestions: data.total_questions ?? 30,
        expiresAt:      exp,
        selectedAnswer: null,
        submitting:     false,
      })
      startTimer(exp)
      setPhase('active')
    } else if (data.status === 'submitted' || data.status === 'expired') {
      setResult({ score: data.score!, total: data.total!, passed: data.passed!, expired: data.status === 'expired' })
      setPhase('result')
    } else {
      setPhase('landing')
    }
  }, [categoryKey])

  useEffect(() => { loadSession() }, [loadSession])

  // ── Start exam ─────────────────────────────────────────────
  async function handleStart() {
    setError('')
    const res = await fetch(`/api/prior-learning-exam/${categoryKey}/start`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to start exam'); return }
    const exp = new Date(data.expires_at)
    setActive({
      sessionId:      data.session_id,
      question:       data.question,
      questionNumber: data.question_number,
      totalQuestions: data.total_questions,
      expiresAt:      exp,
      selectedAnswer: null,
      submitting:     false,
    })
    startTimer(exp)
    setPhase('active')
  }

  // ── Submit answer ──────────────────────────────────────────
  async function handleAnswer() {
    if (!active || !active.selectedAnswer || active.submitting) return
    setActive(a => a ? { ...a, submitting: true } : a)

    const res = await fetch(`/api/prior-learning-exam/${categoryKey}/answer`, {
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
      if (timerRef.current) clearInterval(timerRef.current)
      setResult({ score: data.score, total: data.total, passed: data.passed, expired: !!data.expired })
      setPhase('result')
    } else {
      setActive(a => a ? {
        ...a,
        question:       data.question,
        questionNumber: data.question_number,
        totalQuestions: data.total_questions,
        selectedAnswer: null,
        submitting:     false,
      } : a)
    }
  }

  function getQuestion(q: PriorLearningExamQuestion_Public) {
    return te && q.question_te ? q.question_te : q.question_en
  }
  function getOption(q: PriorLearningExamQuestion_Public, opt: 'a' | 'b' | 'c' | 'd') {
    const teKey = `option_${opt}_te` as keyof PriorLearningExamQuestion_Public
    const enKey = `option_${opt}_en` as keyof PriorLearningExamQuestion_Public
    const teVal = q[teKey] as string | undefined
    return te && teVal ? teVal : q[enKey] as string
  }

  // ─── Loading ──────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-5xl animate-pulse">ॐ</div>
      </div>
    )
  }

  // ─── Active exam ──────────────────────────────────────────
  if (phase === 'active' && active) {
    const pct = Math.round(((active.questionNumber - 1) / active.totalQuestions) * 100)
    const urgentTimer = timeLeft <= 300 // last 5 minutes

    return (
      <div className="min-h-screen bg-brand-bg">
        {/* Sticky top bar with progress + timer */}
        <div className="sticky top-0 z-10 bg-brand-card border-b border-brand-border px-4 py-3">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-brand-gold-muted text-xs">
                {te
                  ? `ప్రశ్న ${active.questionNumber} / ${active.totalQuestions}`
                  : `Question ${active.questionNumber} of ${active.totalQuestions}`}
              </span>
              <span className={`flex items-center gap-1.5 text-xs font-semibold tabular-nums ${urgentTimer ? 'text-red-400' : 'text-brand-gold'}`}>
                <Clock className="w-3.5 h-3.5" />
                {formatTime(timeLeft)}
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
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
            <p className="text-brand-body text-base leading-relaxed font-medium">
              {getQuestion(active.question)}
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {(['a', 'b', 'c', 'd'] as const).map((opt, i) => {
              const selected = active.selectedAnswer === opt
              return (
                <button
                  key={opt}
                  onClick={() => !active.submitting && setActive(a => a ? { ...a, selectedAnswer: opt } : a)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                    selected
                      ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                      : 'border-brand-border text-brand-body hover:border-brand-gold/40 hover:bg-brand-gold/5'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                    selected ? 'border-brand-gold bg-brand-gold text-brand-bg' : 'border-brand-border text-brand-gold-muted'
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
            {active.submitting
              ? (te ? 'సమర్పిస్తున్నాం…' : 'Submitting…')
              : active.questionNumber === active.totalQuestions
                ? (te ? 'పరీక్ష సమర్పించు' : 'Submit Exam')
                : (<>{te ? 'తదుపరి' : 'Next'} <ChevronRight className="w-4 h-4" /></>)
            }
          </button>

          <p className="text-center text-brand-gold-muted text-xs mt-4">
            {te
              ? 'మీరు మునుపటి ప్రశ్నకు తిరిగి వెళ్ళలేరు. జాగ్రత్తగా ఎంచుకోండి.'
              : 'You cannot go back to a previous question. Choose carefully.'}
          </p>
        </div>
      </div>
    )
  }

  // ─── Result ───────────────────────────────────────────────
  if (phase === 'result' && result) {
    const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-8">
        <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-md w-full text-center">
          {result.expired && (
            <div className="flex items-center gap-2 justify-center bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-2.5 mb-5 text-amber-400 text-sm">
              <Clock className="w-4 h-4 shrink-0" />
              {te ? 'సమయం ముగిసింది — సమాధానాలు స్వయంచాలకంగా సమర్పించబడ్డాయి.' : 'Time expired — answers were auto-submitted.'}
            </div>
          )}

          {result.passed ? (
            <>
              <CheckCircle className="w-16 h-16 text-brand-success mx-auto mb-4" />
              <div className="text-brand-gold text-5xl font-bold mb-1">{pct}%</div>
              <div className="text-brand-success font-semibold text-lg mb-2">
                {te ? 'ఉత్తీర్ణులయ్యారు!' : 'Passed!'}
              </div>
              <p className="text-brand-gold-muted text-sm mb-1">
                {te ? `${result.total} లో ${result.score} సరైనవి` : `${result.score} out of ${result.total} correct`}
              </p>
              <p className="text-brand-gold-muted text-sm mb-6">
                {te ? `కనీస అవసరం: ${PASS_THRESHOLD_PCT}%` : `Minimum required: ${PASS_THRESHOLD_PCT}%`}
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-brand-error mx-auto mb-4" />
              <div className="text-brand-gold text-5xl font-bold mb-1">{pct}%</div>
              <div className="text-brand-error font-semibold text-lg mb-2">
                {te ? 'ఉత్తీర్ణులు కాలేదు' : 'Not Passed'}
              </div>
              <p className="text-brand-gold-muted text-sm mb-1">
                {te ? `${result.total} లో ${result.score} సరైనవి` : `${result.score} out of ${result.total} correct`}
              </p>
              <p className="text-brand-gold-muted text-sm mb-6">
                {te
                  ? `ఉత్తీర్ణత కోసం ${PASS_THRESHOLD_PCT}% అవసరం. మీరు మళ్ళీ ప్రయత్నించవచ్చు.`
                  : `You need ${PASS_THRESHOLD_PCT}% to pass. You may retake anytime.`}
              </p>
            </>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={handleStart}
              className="py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
            >
              {te ? 'మళ్ళీ ప్రయత్నించండి' : 'Retake Exam'}
            </button>
            <button
              onClick={() => router.push('/exams')}
              className="py-2.5 border border-brand-border text-brand-gold-muted rounded-xl hover:text-brand-gold hover:border-brand-gold transition-colors text-sm"
            >
              {te ? '← పరీక్షలకు తిరిగి వెళ్ళు' : '← Back to Exams'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Landing ──────────────────────────────────────────────
  const bookName = sessionStatus?.declaration?.book_name

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 py-8">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <span className="text-5xl">📜</span>
          <h1 className="text-brand-gold font-bold text-2xl mt-3 mb-1">{categoryName}</h1>
          {bookName && (
            <p className="text-brand-gold-muted text-xs mb-1">
              {te ? `నేర్చుకున్న గ్రంథం: ${bookName}` : `Declared book: ${bookName}`}
            </p>
          )}
          <p className="text-brand-gold-muted text-sm">
            {te
              ? '30 ప్రశ్నలు · 1 గంట సమయం · 70% ఉత్తీర్ణత'
              : '30 questions · 1 hour · 70% to pass'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-4 text-brand-error text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {[
            {
              label: te ? 'ప్రశ్నలు'     : 'Questions',
              value: te ? '30 (యాదృచ్ఛికంగా ఎంచుకున్నవి)' : '30 (randomly selected)',
            },
            {
              label: te ? 'సమయ పరిమితి' : 'Time limit',
              value: te ? '1 గంట — సమయం ముగిసిన తర్వాత స్వయంచాలకంగా సమర్పించబడతాయి' : '1 hour — auto-submits when time runs out',
            },
            {
              label: te ? 'నావిగేషన్'  : 'Navigation',
              value: te ? 'ఒక్కో ప్రశ్న — వెనక్కి వెళ్ళడం సాధ్యం కాదు' : 'One question at a time — no going back',
            },
            {
              label: te ? 'మళ్ళీ ప్రయత్నం' : 'Retakes',
              value: te ? 'ఎన్నిసార్లైనా ప్రయత్నించవచ్చు' : 'Unlimited retakes',
            },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-brand-gold mt-1.5 shrink-0" />
              <span className="text-brand-body text-sm">
                <strong className="text-brand-gold">{label}:</strong> {value}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={handleStart}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
        >
          {te ? 'పరీక్ష ప్రారంభించు' : 'Start Exam'}
          <ChevronRight className="w-5 h-5" />
        </button>

        <button
          onClick={() => router.push('/exams')}
          className="w-full mt-3 py-2.5 text-brand-gold-muted hover:text-brand-gold transition-colors text-sm"
        >
          {te ? '← పరీక్షలకు తిరిగి వెళ్ళు' : '← Back to Exams'}
        </button>
      </div>
    </div>
  )
}
