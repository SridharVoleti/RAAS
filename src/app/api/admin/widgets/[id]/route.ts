import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const updateSchema = z.object({
  title:     z.string().min(1).max(200).optional(),
  content:   z.string().min(1).max(50000).optional(),
  position:  z.enum(['announcement', 'home-section']).optional(),
  is_active: z.boolean().optional(),
})

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const widgetId = parseInt(id, 10)
  if (isNaN(widgetId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('text_widgets')
    .update(parsed.data)
    .eq('id', widgetId)
    .select()
    .single()

  if (error) {
    logger.error({ error, widgetId }, 'admin.widgets.update.error')
    return NextResponse.json({ error: 'Failed to update widget' }, { status: 500 })
  }

  revalidateTag('widgets')
  logger.info({ widgetId, admin: admin.email }, 'admin.widgets.updated')
  return NextResponse.json({ widget: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const widgetId = parseInt(id, 10)
  if (isNaN(widgetId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('text_widgets')
    .delete()
    .eq('id', widgetId)

  if (error) {
    logger.error({ error, widgetId }, 'admin.widgets.delete.error')
    return NextResponse.json({ error: 'Failed to delete widget' }, { status: 500 })
  }

  revalidateTag('widgets')
  logger.info({ widgetId, admin: admin.email }, 'admin.widgets.deleted')
  return NextResponse.json({ ok: true })
}
