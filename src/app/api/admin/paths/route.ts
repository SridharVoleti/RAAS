import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { PathSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('paths')
    .select('*')
    .order('order_index', { ascending: true })

  if (error) {
    logger.error({ error }, 'admin.paths.list.error')
    return NextResponse.json({ error: 'Failed to fetch paths' }, { status: 500 })
  }

  return NextResponse.json({ paths: data ?? [] })
}

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const body = await req.json().catch(() => null)
  const parsed = PathSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('paths')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    logger.error({ error }, 'admin.paths.create.error')
    const status = error.code === '23505' ? 409 : 500
    return NextResponse.json({
      error: status === 409 ? 'A path with this slug already exists' : 'Failed to create path',
    }, { status })
  }

  revalidateTag('paths')
  logger.info({ pathId: data.id, slug: data.slug, admin: admin.email }, 'admin.paths.created')
  return NextResponse.json({ path: data }, { status: 201 })
}
