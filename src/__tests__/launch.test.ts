import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getLaunchAt, isLive } from '@/lib/launch'

const ORIGINAL_ENV = process.env.NEXT_PUBLIC_LAUNCH_AT

describe('getLaunchAt', () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_LAUNCH_AT = ORIGINAL_ENV
  })

  it('falls back to the default launch instant when env var is unset', () => {
    delete process.env.NEXT_PUBLIC_LAUNCH_AT
    expect(getLaunchAt().toISOString()).toBe('2026-08-01T00:30:00.000Z')
  })

  it('falls back to the default launch instant when env var is invalid', () => {
    process.env.NEXT_PUBLIC_LAUNCH_AT = 'not-a-date'
    expect(getLaunchAt().toISOString()).toBe('2026-08-01T00:30:00.000Z')
  })

  it('honors a valid override', () => {
    process.env.NEXT_PUBLIC_LAUNCH_AT = '2027-01-01T00:00:00.000Z'
    expect(getLaunchAt().toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })
})

describe('isLive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    delete process.env.NEXT_PUBLIC_LAUNCH_AT
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.NEXT_PUBLIC_LAUNCH_AT = ORIGINAL_ENV
  })

  it('returns false just before the default launch instant', () => {
    vi.setSystemTime(new Date('2026-08-01T00:29:59.999Z'))
    expect(isLive()).toBe(false)
  })

  it('returns true exactly at the default launch instant', () => {
    vi.setSystemTime(new Date('2026-08-01T00:30:00.000Z'))
    expect(isLive()).toBe(true)
  })

  it('returns true well after the default launch instant', () => {
    vi.setSystemTime(new Date('2026-09-01T00:00:00.000Z'))
    expect(isLive()).toBe(true)
  })

  it('accepts an explicit now argument instead of reading the clock', () => {
    expect(isLive(new Date('2020-01-01T00:00:00.000Z'))).toBe(false)
    expect(isLive(new Date('2030-01-01T00:00:00.000Z'))).toBe(true)
  })
})
