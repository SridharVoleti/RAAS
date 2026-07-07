import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { PathUpdateSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const pathId = parseInt(id, 10)
  if (isNaN(pathId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = PathUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('paths')
    .update(parsed.data)
    .eq('id', pathId)
    .select()
    .single()

  if (error) {
    logger.error({ error, pathId }, 'admin.paths.update.error')
    return NextResponse.json({ error: 'Failed to update path' }, { status: 500 })
  }

  revalidateTag('paths')
  logger.info({ pathId, admin: admin.email }, 'admin.paths.updated')
  return NextResponse.json({ path: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const pathId = parseInt(id, 10)
  if (isNaN(pathId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('paths')
    .delete()
    .eq('id', pathId)

  if (error) {
    // 23503 = foreign_key_violation: courses still reference this path
    if (error.code === '23503') {
      return NextResponse.json({
        error: 'This path still has courses — move them to another path first',
      }, { status: 409 })
    }
    logger.error({ error, pathId }, 'admin.paths.delete.error')
    return NextResponse.json({ error: 'Failed to delete path' }, { status: 500 })
  }

  revalidateTag('paths')
  logger.info({ pathId, admin: admin.email }, 'admin.paths.deleted')
  return NextResponse.json({ ok: true })
}
