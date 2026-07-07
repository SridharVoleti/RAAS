'use client'

import { useEffect, useState } from 'react'
import { X, Star, CheckCircle, AlertCircle } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import type { Testimonial } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
}

interface MyCourse {
  id: number
  title_en: string
  title_te: string | null
}

export default function TestimonialDialog({ open, onClose }: Props) {
  const { lang, t } = useLang()
  const tv = t.voices

  const [name, setName] = useState('')
  const [courseId, setCourseId] = useState<number | ''>('')
  const [rating, setRating] = useState(5)
  const [message, setMessage] = useState('')
  const [courses, setCourses] = useState<MyCourse[]>([])
  const [previous, setPrevious] = useState<Testimonial[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setSubmitted(false)
    setError('')

    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()
      if (profile?.full_name) setName(prev => prev || profile.full_name)
    })

    fetch('/api/my-courses')
      .then(res => (res.ok ? res.json() : []))
      .then(data => { if (Array.isArray(data)) setCourses(data) })
      .catch(() => {})

    fetch('/api/testimonials')
      .then(res => (res.ok ? res.json() : { testimonials: [] }))
      .then(data => setPrevious(data.testimonials ?? []))
      .catch(() => {})
  }, [open])

  if (!open) return null

  const valid = name.trim().length >= 2 && message.trim().length >= 10

  async function handleSubmit() {
    if (!valid || submitting) return
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reviewerName: name.trim(),
        message:      message.trim(),
        rating,
        ...(courseId !== '' ? { courseId } : {}),
      }),
    })

    if (res.ok) {
      setSubmitted(true)
      setMessage('')
    } else if (res.status === 403) {
      setError(tv.enrollFirst)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(typeof d.error === 'string' ? d.error : 'Something went wrong')
    }
    setSubmitting(false)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-brand-card border border-brand-border rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-brand-gold font-bold text-lg">{tv.dialogTitle}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-brand-gold-muted hover:text-brand-gold hover:bg-brand-border/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-brand-gold-muted text-xs mb-5">{tv.subtitle}</p>

        {submitted ? (
          <div className="text-center py-6">
            <CheckCircle className="w-12 h-12 text-brand-success mx-auto mb-3" />
            <p className="text-brand-body text-sm leading-relaxed mb-5">{tv.thanks}</p>
            <button
              onClick={() => setSubmitted(false)}
              className="text-brand-gold text-sm font-semibold hover:underline"
            >
              {tv.shareAnother}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 text-brand-error text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="block text-brand-gold-muted text-xs mb-1">{tv.name}</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-brand-body text-sm focus:border-brand-gold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-brand-gold-muted text-xs mb-1">{tv.course}</label>
              <select
                value={courseId}
                onChange={e => setCourseId(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-brand-body text-sm focus:border-brand-gold focus:outline-none"
              >
                <option value="">{tv.generalFeedback}</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {lang === 'te' && c.title_te ? c.title_te : c.title_en}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-brand-gold-muted text-xs mb-1">{tv.rating}</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
                    <Star
                      className={`w-7 h-7 transition-colors ${
                        n <= rating ? 'fill-brand-gold text-brand-gold' : 'text-brand-border'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-brand-gold-muted text-xs mb-1">{tv.message}</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={tv.messagePlaceholder}
                className="w-full bg-brand-bg border border-brand-border rounded-xl px-4 py-2.5 text-brand-body text-sm focus:border-brand-gold focus:outline-none resize-none"
              />
              <p className="text-right text-brand-gold-muted text-xs mt-0.5">{message.length}/1000</p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!valid || submitting}
              className="w-full py-3 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? tv.submitting : tv.submit}
            </button>

            {previous.length > 0 && (
              <div className="pt-2 border-t border-brand-border">
                <p className="text-brand-gold-muted text-xs mb-2">{tv.previousSubmissions}</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {previous.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-brand-body truncate">{p.content_en}</span>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full font-medium ${
                        p.is_published
                          ? 'bg-brand-success/15 text-brand-success'
                          : 'bg-brand-gold/15 text-brand-gold'
                      }`}>
                        {p.is_published ? tv.published : tv.pendingReview}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
