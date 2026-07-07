import { createClient } from '@/lib/supabase/client'
import type { LearningPath } from '@/types'

// Module-level cache, same approach as getCourses
let cached: { data: LearningPath[]; expires: number } | null = null
const CACHE_TTL = 24 * 60 * 60 * 1000

export function invalidatePathsCache(): void {
  cached = null
}

/** All learning paths (active and inactive), ordered. Empty array on failure. */
export async function getPaths(): Promise<LearningPath[]> {
  if (cached && Date.now() < cached.expires) return cached.data

  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('paths')
      .select('*')
      .order('order_index', { ascending: true })
    if (error || !data) return []
    cached = { data: data as LearningPath[], expires: Date.now() + CACHE_TTL }
    return data as LearningPath[]
  } catch {
    return []
  }
}
