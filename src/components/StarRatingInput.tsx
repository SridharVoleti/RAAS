'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'

interface StarRatingInputProps {
  initialValue?: number | null
  onSubmit: (rating: number) => Promise<void> | void
  size?: 'sm' | 'md'
}

export default function StarRatingInput({ initialValue = null, onSubmit, size = 'md' }: StarRatingInputProps) {
  const [value, setValue] = useState<number | null>(initialValue)
  const [hover, setHover] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const starSize = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7'
  const shown = hover ?? value ?? 0

  async function handleClick(n: number) {
    if (submitting) return
    const previous = value
    setSubmitting(true)
    setValue(n)
    try {
      await onSubmit(n)
    } catch {
      setValue(previous)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={submitting}
          onClick={() => handleClick(n)}
          onMouseEnter={() => setHover(n)}
          className="disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className={`${starSize} transition-colors ${shown >= n ? 'fill-brand-gold text-brand-gold' : 'text-brand-gold-muted'}`} />
        </button>
      ))}
    </div>
  )
}
