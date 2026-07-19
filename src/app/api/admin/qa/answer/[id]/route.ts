import { NextResponse } from 'next/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const answerId = parseInt(id, 10)
  if (isNaN(answerId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('course_answers').delete().eq('id', answerId)

  if (error) {
    logger.error({ error, answerId }, 'admin.qa.answer.delete.error')
    return NextResponse.json({ error: 'Failed to delete answer' }, { status: 500 })
  }

  logger.info({ answerId, admin: admin.email }, 'admin.qa.answer.deleted')
  return NextResponse.json({ ok: true })
}
