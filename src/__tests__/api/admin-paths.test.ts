import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GET as listPaths, POST as createPath } from '@/app/api/admin/paths/route'
import { PUT as updatePath, DELETE as deletePath } from '@/app/api/admin/paths/[id]/route'

vi.mock('@/lib/supabase/server', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/admin', () => ({ getAdminUser: vi.fn(), forbidden: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { revalidateTag } from 'next/cache'

const idParams = { params: Promise.resolve({ id: '2' }) }

function chain(result: unknown = { data: null, error: null }) {
  const c: any = {}
  for (const m of ['select', 'eq', 'order', 'update', 'delete']) {
    c[m] = vi.fn(() => c)
  }
  c.insert = vi.fn(() => c)
  c.single = vi.fn().mockResolvedValue(result)
  c.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject)
  return c
}

function mockAdminClient(pathsChain: any) {
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn(() => pathsChain),
  } as any)
}

function jsonRequest(body: unknown, method = 'POST') {
  return new Request('http://localhost/', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validPath = {
  slug: 'daas',
  name: 'DAAS',
  full_name_en: 'Dravida Veda Adhyapana Adhayapaka Samakhya',
  full_name_te: 'ద్రావిడ వేద అధ్యాపన అధ్యాపక సమాఖ్య',
  tagline_en: 'Coming Soon',
}

describe('admin paths routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAdminUser).mockResolvedValue({ id: 'admin-1', email: 'a@b.c' } as any)
    vi.mocked(forbidden).mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }) as any
    )
  })

  it('GET is forbidden for non-admins', async () => {
    vi.mocked(getAdminUser).mockResolvedValue(null)
    await listPaths()
    expect(forbidden).toHaveBeenCalled()
  })

  it('GET returns all paths ordered', async () => {
    mockAdminClient(chain({ data: [{ id: 1, slug: 'raas' }, { id: 2, slug: 'daas' }], error: null }))
    const res = await listPaths()
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.paths).toHaveLength(2)
  })

  it('POST rejects an invalid slug', async () => {
    mockAdminClient(chain())
    const res = await createPath(jsonRequest({ ...validPath, slug: 'Bad Slug!' }))
    expect(res.status).toBe(400)
  })

  it('POST creates a path and revalidates the cache', async () => {
    const c = chain({ data: { id: 2, ...validPath }, error: null })
    mockAdminClient(c)
    const res = await createPath(jsonRequest(validPath))
    expect(res.status).toBe(201)
    expect(c.insert).toHaveBeenCalledWith(expect.objectContaining({ slug: 'daas', name: 'DAAS' }))
    expect(revalidateTag).toHaveBeenCalledWith('paths')
  })

  it('POST maps a duplicate slug to 409', async () => {
    mockAdminClient(chain({ data: null, error: { code: '23505', message: 'duplicate' } }))
    const res = await createPath(jsonRequest(validPath))
    expect(res.status).toBe(409)
  })

  it('PUT updates a path and revalidates the cache', async () => {
    const c = chain({ data: { id: 2, ...validPath, is_active: true }, error: null })
    mockAdminClient(c)
    const res = await updatePath(jsonRequest({ is_active: true }, 'PUT'), idParams)
    expect(res.status).toBe(200)
    expect(c.update).toHaveBeenCalledWith({ is_active: true })
    expect(revalidateTag).toHaveBeenCalledWith('paths')
  })

  it('PUT rejects an invalid id', async () => {
    mockAdminClient(chain())
    const res = await updatePath(jsonRequest({ is_active: true }, 'PUT'), {
      params: Promise.resolve({ id: 'abc' }),
    })
    expect(res.status).toBe(400)
  })

  it('DELETE maps a foreign-key violation to 409 with a helpful message', async () => {
    mockAdminClient(chain({ error: { code: '23503', message: 'fk violation' } }))
    const res = await deletePath(new Request('http://localhost/'), idParams)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toContain('still has courses')
  })

  it('DELETE removes a path and revalidates the cache', async () => {
    const c = chain({ error: null })
    mockAdminClient(c)
    const res = await deletePath(new Request('http://localhost/'), idParams)
    expect(res.status).toBe(200)
    expect(c.delete).toHaveBeenCalled()
    expect(revalidateTag).toHaveBeenCalledWith('paths')
  })
})
