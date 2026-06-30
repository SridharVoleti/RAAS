'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import type { PriorLearningConfig } from '@/lib/priorLearningConfigs'

interface Props {
  config: PriorLearningConfig
  isOpen: boolean
  onClose: () => void
  onDeclared: () => void
}

type Step = 'question' | 'form' | 'success'

export default function PriorLearningDialog({ config, isOpen, onClose, onDeclared }: Props) {
  const { lang } = useLang()
  const [step, setStep] = useState<Step>('question')
  const [bookName, setBookName] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [teacherMobile, setTeacherMobile] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const te = lang === 'te'
  const categoryName = te ? config.categoryName.te : config.categoryName.en

  const ui = {
    title:                  te ? 'పూర్వ అభ్యాస ప్రకటన'                       : 'Prior Learning Declaration',
    question:               te ? `మీరు ఇప్పటికే ${categoryName} పూర్తి చేశారా?` : `Have you already completed learning a ${categoryName}?`,
    yes:                    te ? 'అవును, నేర్చుకున్నాను'                       : 'Yes, I have',
    no:                     te ? 'లేదు, నేర్చుకోలేదు'                          : 'No, I haven\'t',
    selectBook:             te ? 'మీరు నేర్చుకున్న గ్రంథాన్ని ఎంచుకోండి'      : 'Which book have you learnt?',
    selectPlaceholder:      te ? 'గ్రంథం ఎంచుకోండి'                           : 'Select a book',
    teacherName:            te ? 'గురువు పేరు'                                 : "Teacher's Name",
    teacherNamePlaceholder: te ? 'గురువు పేరు నమోదు చేయండి'                  : "Enter your teacher's name",
    teacherMobile:          te ? 'గురువు మొబైల్ నంబర్'                        : "Teacher's Mobile Number",
    teacherMobilePlaceholder: te ? 'గురువు మొబైల్ నంబర్ నమోదు చేయండి'       : "Enter teacher's mobile number",
    submit:                 te ? 'సమర్పించు'                                   : 'Submit',
    submitting:             te ? 'సమర్పిస్తున్నాం...'                           : 'Submitting...',
    success:                te ? `ధన్యవాదాలు! మీ పూర్వ అభ్యాస వివరాలు నమోదు చేయబడ్డాయి.` : 'Thank you! Your prior learning has been recorded.',
    close:                  te ? 'మూసివేయి'                                    : 'Close',
    errBook:                te ? 'దయచేసి గ్రంథాన్ని ఎంచుకోండి'                : 'Please select a book',
    errTeacher:             te ? 'గురువు పేరు అవసరం'                           : "Teacher's name is required",
    errMobile:              te ? 'గురువు మొబైల్ నంబర్ అవసరం'                  : "Teacher's mobile number is required",
    errMobileInvalid:       te ? 'చెల్లుబాటు అయ్యే మొబైల్ నంబర్ నమోదు చేయండి' : 'Enter a valid mobile number (7–15 digits)',
  }

  function handleClose() {
    setStep('question')
    setBookName('')
    setTeacherName('')
    setTeacherMobile('')
    setErrors({})
    onClose()
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!bookName) e.book = ui.errBook
    if (!teacherName.trim()) e.teacher = ui.errTeacher
    if (!teacherMobile.trim()) e.mobile = ui.errMobile
    else if (!/^\d{7,15}$/.test(teacherMobile.trim())) e.mobile = ui.errMobileInvalid
    return e
  }

  async function handleSubmit() {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/prior-learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryKey:   config.categoryKey,
          bookName,
          teacherName:   teacherName.trim(),
          teacherMobile: teacherMobile.trim(),
        }),
      })
      if (res.ok) {
        setStep('success')
        onDeclared()
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="relative w-full max-w-md bg-brand-card border border-brand-gold/30 rounded-2xl shadow-2xl shadow-brand-gold/10 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-brand-gold font-bold text-lg">{ui.title}</h2>
          <button
            onClick={handleClose}
            className="text-brand-gold-muted hover:text-brand-gold transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step: question */}
        {step === 'question' && (
          <div>
            <p className="text-brand-body text-sm leading-relaxed mb-6">{ui.question}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setStep('form')}
                className="flex-1 py-2.5 rounded-lg bg-brand-gold text-brand-bg font-semibold text-sm hover:bg-yellow-400 transition-colors"
              >
                {ui.yes}
              </button>
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg border border-brand-border text-brand-gold-muted font-medium text-sm hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                {ui.no}
              </button>
            </div>
          </div>
        )}

        {/* Step: form */}
        {step === 'form' && (
          <div className="space-y-4">
            {/* Book dropdown */}
            <div>
              <label className="block text-brand-gold-muted text-xs font-medium mb-1.5">{ui.selectBook}</label>
              <select
                value={bookName}
                onChange={(e) => { setBookName(e.target.value); setErrors(prev => ({ ...prev, book: '' })) }}
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-brand-body text-sm focus:outline-none focus:border-brand-gold transition-colors"
              >
                <option value="">{ui.selectPlaceholder}</option>
                {config.books.map(b => (
                  <option key={b.en} value={b.en}>
                    {te ? b.te : b.en}
                  </option>
                ))}
              </select>
              {errors.book && <p className="text-red-400 text-xs mt-1">{errors.book}</p>}
            </div>

            {/* Teacher name */}
            <div>
              <label className="block text-brand-gold-muted text-xs font-medium mb-1.5">{ui.teacherName}</label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => { setTeacherName(e.target.value); setErrors(prev => ({ ...prev, teacher: '' })) }}
                placeholder={ui.teacherNamePlaceholder}
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-brand-body text-sm placeholder-brand-gold-muted/50 focus:outline-none focus:border-brand-gold transition-colors"
              />
              {errors.teacher && <p className="text-red-400 text-xs mt-1">{errors.teacher}</p>}
            </div>

            {/* Teacher mobile */}
            <div>
              <label className="block text-brand-gold-muted text-xs font-medium mb-1.5">{ui.teacherMobile}</label>
              <input
                type="tel"
                value={teacherMobile}
                onChange={(e) => { setTeacherMobile(e.target.value.replace(/\D/g, '')); setErrors(prev => ({ ...prev, mobile: '' })) }}
                placeholder={ui.teacherMobilePlaceholder}
                maxLength={15}
                className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-brand-body text-sm placeholder-brand-gold-muted/50 focus:outline-none focus:border-brand-gold transition-colors"
              />
              {errors.mobile && <p className="text-red-400 text-xs mt-1">{errors.mobile}</p>}
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-brand-gold text-brand-bg font-semibold text-sm hover:bg-yellow-400 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {submitting ? ui.submitting : ui.submit}
            </button>
          </div>
        )}

        {/* Step: success */}
        {step === 'success' && (
          <div className="text-center py-4">
            <div className="text-4xl mb-4">🙏</div>
            <p className="text-brand-body text-sm leading-relaxed mb-6">{ui.success}</p>
            <button
              onClick={handleClose}
              className="px-6 py-2.5 rounded-lg bg-brand-gold text-brand-bg font-semibold text-sm hover:bg-yellow-400 transition-colors"
            >
              {ui.close}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
