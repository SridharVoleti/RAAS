import { NextResponse } from 'next/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const questionId = parseInt(id, 10)
  if (isNaN(questionId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('course_questions').delete().eq('id', questionId)

  if (error) {
    logger.error({ error, questionId }, 'admin.qa.question.delete.error')
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
  }

  logger.info({ questionId, admin: admin.email }, 'admin.qa.question.deleted')
  return NextResponse.json({ ok: true })
}
