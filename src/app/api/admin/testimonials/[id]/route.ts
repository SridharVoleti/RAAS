import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const updateSchema = z.object({
  is_published: z.boolean(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const testimonialId = parseInt(id, 10)
  if (isNaN(testimonialId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('testimonials')
    .update({ is_published: parsed.data.is_published })
    .eq('id', testimonialId)
    .select()
    .single()

  if (error) {
    logger.error({ error, testimonialId }, 'admin.testimonials.update.error')
    return NextResponse.json({ error: 'Failed to update testimonial' }, { status: 500 })
  }

  revalidateTag('testimonials')
  logger.info({ testimonialId, is_published: parsed.data.is_published, admin: admin.email }, 'admin.testimonials.updated')
  return NextResponse.json({ testimonial: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const testimonialId = parseInt(id, 10)
  if (isNaN(testimonialId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('testimonials')
    .delete()
    .eq('id', testimonialId)

  if (error) {
    logger.error({ error, testimonialId }, 'admin.testimonials.delete.error')
    return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 })
  }

  revalidateTag('testimonials')
  logger.info({ testimonialId, admin: admin.email }, 'admin.testimonials.deleted')
  return NextResponse.json({ ok: true })
}
