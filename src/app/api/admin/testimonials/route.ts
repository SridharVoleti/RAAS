import { NextResponse } from 'next/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('testimonials')
    .select('*, courses(title_en)')
    .order('created_at', { ascending: false })

  if (error) {
    logger.error({ error }, 'admin.testimonials.list.error')
    return NextResponse.json({ error: 'Failed to fetch testimonials' }, { status: 500 })
  }

  return NextResponse.json({ testimonials: data ?? [] })
}
