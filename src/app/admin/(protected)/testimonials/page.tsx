'use client'

import { useState, useEffect, useCallback } from 'react'
import { Eye, EyeOff, Trash2, Star, Loader2, MessageSquareQuote } from 'lucide-react'
import type { Testimonial } from '@/types'

type AdminTestimonial = Testimonial & { courses?: { title_en: string } | null }

export default function AdminTestimonialsPage() {
  const [testimonials, setTestimonials] = useState<AdminTestimonial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/testimonials')
      if (!res.ok) throw new Error('Failed to load testimonials')
      const data = await res.json()
      setTestimonials(data.testimonials)
    } catch {
      setError('Failed to load testimonials.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function togglePublished(item: AdminTestimonial) {
    setBusyId(item.id)
    const res = await fetch(`/api/admin/testimonials/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !item.is_published }),
    })
    if (res.ok) {
      setTestimonials(prev =>
        prev.map(x => (x.id === item.id ? { ...x, is_published: !item.is_published } : x))
      )
    } else {
      setError('Failed to update visibility.')
    }
    setBusyId(null)
  }

  async function handleDelete(id: number) {
    setBusyId(id)
    const res = await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTestimonials(prev => prev.filter(x => x.id !== id))
    } else {
      setError('Failed to delete testimonial.')
    }
    setBusyId(null)
    setConfirmDeleteId(null)
  }

  const pendingCount = testimonials.filter(x => !x.is_published).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-brand-gold font-bold text-2xl flex items-center gap-2">
            <MessageSquareQuote className="w-6 h-6" />
            Student Voices
          </h1>
          <p className="text-brand-gold-muted text-sm mt-1">
            Choose which student testimonials appear on the home page.
            {pendingCount > 0 && ` ${pendingCount} pending review.`}
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-brand-error/10 border border-brand-error/30 rounded-xl px-4 py-3 mb-4 text-brand-error text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-brand-gold-muted">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : testimonials.length === 0 ? (
        <div className="text-center py-16 text-brand-gold-muted text-sm">
          No student voices submitted yet.
        </div>
      ) : (
        <div className="space-y-3">
          {testimonials.map(item => (
            <div
              key={item.id}
              className={`bg-brand-card border rounded-xl p-4 ${
                item.is_published ? 'border-brand-success/40' : 'border-brand-border'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-brand-gold font-semibold text-sm">{item.reviewer_name}</span>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < item.rating ? 'fill-brand-gold text-brand-gold' : 'text-brand-border'
                          }`}
                        />
                      ))}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.is_published
                        ? 'bg-brand-success/15 text-brand-success'
                        : 'bg-brand-gold/15 text-brand-gold'
                    }`}>
                      {item.is_published ? 'Visible on home page' : 'Hidden'}
                    </span>
                  </div>
                  <p className="text-brand-body text-sm leading-relaxed whitespace-pre-wrap">{item.content_en}</p>
                  <p className="text-brand-gold-muted text-xs mt-2">
                    {new Date(item.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    {item.courses?.title_en ? ` · ${item.courses.title_en}` : ' · General feedback'}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => togglePublished(item)}
                    disabled={busyId === item.id}
                    title={item.is_published ? 'Hide from home page' : 'Show on home page'}
                    className={`p-2 rounded-lg border transition-colors disabled:opacity-50 ${
                      item.is_published
                        ? 'border-brand-success/40 text-brand-success hover:bg-brand-success/10'
                        : 'border-brand-border text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold'
                    }`}
                  >
                    {busyId === item.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : item.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  {confirmDeleteId === item.id ? (
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={busyId === item.id}
                      className="px-2.5 py-2 rounded-lg bg-brand-error text-white text-xs font-semibold hover:bg-red-500 transition-colors disabled:opacity-50"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(item.id)}
                      title="Delete"
                      className="p-2 rounded-lg border border-brand-border text-brand-gold-muted hover:text-brand-error hover:border-brand-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
