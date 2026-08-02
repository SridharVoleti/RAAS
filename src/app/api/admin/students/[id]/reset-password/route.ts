import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, AdminResetPasswordSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const parsed = await parseBody(req, AdminResetPasswordSchema)
  if (!parsed.success) return parsed.response

  const supabase = await createAdminClient()
  const { error } = await supabase.auth.admin.updateUserById(id, { password: parsed.data.password })

  if (error) {
    logger.error({ err: error, studentId: id }, 'admin.students.reset-password.failed')
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }

  logger.info({ studentId: id, adminId: admin.id }, 'admin.students.reset-password.success')
  return NextResponse.json({ success: true })
}
