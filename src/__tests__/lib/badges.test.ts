import { describe, it, expect } from 'vitest'
import { effectiveBadge } from '@/lib/badges'

describe('effectiveBadge', () => {
  it('returns Coming Soon when a course has zero lessons, regardless of its stored badge', () => {
    expect(effectiveBadge(null, 0)).toBe('Coming Soon')
    expect(effectiveBadge('Popular', 0)).toBe('Coming Soon')
    expect(effectiveBadge('New', 0)).toBe('Coming Soon')
    expect(effectiveBadge('Free', 0)).toBe('Coming Soon')
  })

  it('returns the stored badge unchanged once the course has at least one lesson', () => {
    expect(effectiveBadge('Popular', 1)).toBe('Popular')
    expect(effectiveBadge(null, 3)).toBe(null)
  })
})
