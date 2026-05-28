import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET } from '@/app/api/admin/students/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

const mockAdmin = { id: 'admin-1', is_admin: true }

function mockSupabase(profiles: Record<string, unknown>[], authUsers: { id: string; email: string }[] = []) {
  vi.mocked(createAdminClient).mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: profiles, error: null }),
        }
      }
      if (table === 'enrollments') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {}
    }),
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: authUsers } }),
      },
    },
  } as any)
}

describe('GET /api/admin/students', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue(mockAdmin as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('returns 403 when not an admin', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await GET(new Request('http://localhost/api/admin/students'))
    expect(forbidden).toHaveBeenCalled()
  })

  it('returns empty items and null nextCursor when no students', async () => {
    mockSupabase([])
    const res = await GET(new Request('http://localhost/api/admin/students'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items).toEqual([])
    expect(data.nextCursor).toBeNull()
  })

  it('returns students with email from auth users', async () => {
    const profiles = [{ id: 'u1', full_name: 'Alice', created_at: '2024-01-01T00:00:00Z', is_admin: false, avatar_initials: 'A' }]
    const authUsers = [{ id: 'u1', email: 'alice@example.com' }]
    mockSupabase(profiles, authUsers)
    const res = await GET(new Request('http://localhost/api/admin/students'))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.items[0].email).toBe('alice@example.com')
    expect(data.items[0].full_name).toBe('Alice')
  })

  it('defaults email to empty string when auth user not found', async () => {
    const profiles = [{ id: 'u1', full_name: 'Bob', created_at: '2024-01-01T00:00:00Z', is_admin: false, avatar_initials: 'B' }]
    mockSupabase(profiles, [])
    const res = await GET(new Request('http://localhost/api/admin/students'))
    const data = await res.json()
    expect(data.items[0].email).toBe('')
  })

  it('sets nextCursor when there are more results than the limit', async () => {
    // 3 profiles but limit=2 → hasMore=true
    const profiles = Array.from({ length: 3 }, (_, i) => ({
      id: `u${i + 1}`,
      full_name: `User ${i + 1}`,
      created_at: `2024-01-0${i + 1}T00:00:00Z`,
      is_admin: false,
      avatar_initials: 'U',
    }))
    mockSupabase(profiles)
    const res = await GET(new Request('http://localhost/api/admin/students?limit=2'))
    const data = await res.json()
    expect(data.nextCursor).not.toBeNull()
    expect(data.items).toHaveLength(2)
  })
})
