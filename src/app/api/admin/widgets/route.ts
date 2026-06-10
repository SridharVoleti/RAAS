import { NextResponse } from 'next/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const widgetSchema = z.object({
  title:     z.string().min(1).max(200),
  content:   z.string().min(1).max(2000),
  position:  z.enum(['announcement', 'home-section']),
  is_active: z.boolean().optional().default(true),
})

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('text_widgets')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error({ error }, 'admin.widgets.list.error')
    return NextResponse.json({ error: 'Failed to fetch widgets' }, { status: 500 })
  }

  return NextResponse.json({ widgets: data ?? [] })
}

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const body = await req.json().catch(() => null)
  const parsed = widgetSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('text_widgets')
    .insert(parsed.data)
    .select()
    .single()

  if (error) {
    logger.error({ error }, 'admin.widgets.create.error')
    return NextResponse.json({ error: 'Failed to create widget' }, { status: 500 })
  }

  logger.info({ widgetId: data.id, admin: admin.email }, 'admin.widgets.created')
  return NextResponse.json({ widget: data }, { status: 201 })
}
