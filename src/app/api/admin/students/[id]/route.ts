import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, AdminUpdateProfileSchema } from '@/lib/validation'
import { getAvatarInitials } from '@/lib/utils'
import { logger } from '@/lib/logger'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const parsed = await parseBody(req, AdminUpdateProfileSchema)
  if (!parsed.success) return parsed.response
  const body = parsed.data

  const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }
  if (body.full_name) {
    updates.avatar_initials = getAvatarInitials(body.full_name)
  }

  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      const field = error.message.includes('username') ? 'Username' : 'Student ID'
      return NextResponse.json({ error: `${field} is already in use by another student.` }, { status: 409 })
    }
    logger.error({ err: error, studentId: id }, 'admin.students.update.failed')
    return NextResponse.json({ error: 'Failed to update student' }, { status: 500 })
  }

  logger.info({ studentId: id, fields: Object.keys(body) }, 'admin.students.updated')
  return NextResponse.json({ success: true })
}
