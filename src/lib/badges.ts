export const BADGE_STYLES: Record<string, string> = {
  Popular: 'bg-brand-gold text-brand-bg',
  New: 'bg-brand-success text-brand-bg',
  Free: 'bg-blue-500 text-white',
  'Coming Soon': 'bg-brand-border text-brand-body',
}

/** A course with no lessons yet always shows as Coming Soon, overriding any badge an admin picked. */
export function effectiveBadge(
  badge: 'Popular' | 'New' | 'Free' | 'Coming Soon' | null,
  lessonCount: number
): 'Popular' | 'New' | 'Free' | 'Coming Soon' | null {
  return lessonCount === 0 ? 'Coming Soon' : badge
}
