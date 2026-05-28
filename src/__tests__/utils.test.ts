import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cn, formatPrice, getAvatarInitials, isAfterElevenPM, getISTHour } from '@/lib/utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('deduplicates tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'extra')).toBe('base extra')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})

describe('formatPrice', () => {
  it('returns Free for 0', () => {
    expect(formatPrice(0)).toBe('Free')
  })

  it('formats small price with rupee symbol', () => {
    expect(formatPrice(100)).toBe('₹100')
  })

  it('formats thousands with Indian locale comma', () => {
    // en-IN locale: 10000 → 10,000
    expect(formatPrice(10000)).toBe('₹10,000')
  })

  it('formats lakhs with Indian locale', () => {
    // en-IN locale: 100000 → 1,00,000
    expect(formatPrice(100000)).toBe('₹1,00,000')
  })
})

describe('getAvatarInitials', () => {
  it('returns single initial for one-word name', () => {
    expect(getAvatarInitials('John')).toBe('J')
  })

  it('returns first and last initials for full name', () => {
    expect(getAvatarInitials('John Doe')).toBe('JD')
  })

  it('uses first and last word for multi-word names', () => {
    expect(getAvatarInitials('John Michael Doe')).toBe('JD')
  })

  it('uppercases the initials', () => {
    expect(getAvatarInitials('john doe')).toBe('JD')
  })

  it('trims leading/trailing whitespace', () => {
    expect(getAvatarInitials('  Alice  ')).toBe('A')
  })
})

describe('isAfterElevenPM', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true when IST time is 11 PM exactly (UTC 17:30)', () => {
    // UTC 17:30 → IST 23:00
    vi.setSystemTime(new Date('2024-01-01T17:30:00Z'))
    expect(isAfterElevenPM()).toBe(true)
  })

  it('returns true when IST time is past 11 PM (UTC 18:00 → IST 23:30)', () => {
    vi.setSystemTime(new Date('2024-01-01T18:00:00Z'))
    expect(isAfterElevenPM()).toBe(true)
  })

  it('returns false at midnight IST (UTC 18:30 → IST 00:00 — hour 0, not 23)', () => {
    vi.setSystemTime(new Date('2024-01-01T18:30:00Z'))
    expect(isAfterElevenPM()).toBe(false)
  })

  it('returns true at IST 23:59 (UTC 18:29)', () => {
    vi.setSystemTime(new Date('2024-01-01T18:29:00Z'))
    expect(isAfterElevenPM()).toBe(true)
  })

  it('returns false just before 11 PM IST (UTC 17:29 → IST 22:59)', () => {
    vi.setSystemTime(new Date('2024-01-01T17:29:00Z'))
    expect(isAfterElevenPM()).toBe(false)
  })

  it('returns false in the afternoon IST (UTC 10:00 → IST 15:30)', () => {
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'))
    expect(isAfterElevenPM()).toBe(false)
  })
})

describe('getISTHour', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns correct IST hour for a UTC noon time', () => {
    // UTC 12:00 → IST 17:30 → hour 17
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
    expect(getISTHour()).toBe(17)
  })

  it('returns correct IST hour for UTC midnight', () => {
    // UTC 00:00 → IST 05:30 → hour 5
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
    expect(getISTHour()).toBe(5)
  })

  it('returns correct IST hour near midnight IST', () => {
    // UTC 17:30 → IST 23:00 → hour 23
    vi.setSystemTime(new Date('2024-01-01T17:30:00Z'))
    expect(getISTHour()).toBe(23)
  })
})
