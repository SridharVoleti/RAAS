import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseBody, UpdateProfileSchema, ChangePasswordSchema } from '@/lib/validation'
import { getAvatarInitials } from '@/lib/utils'
import { logger } from '@/lib/logger'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_initials, mobile, isd_code, city, country, preferred_lang, profile_complete')
      .eq('id', user.id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    return NextResponse.json({ ...data, email: user.email })
  } catch (err) {
    logger.error({ error: String(err) }, 'profile.get.failed')
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = await parseBody(req, UpdateProfileSchema)
    if (!parsed.success) return parsed.response
    const body = parsed.data

    const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }

    if (body.full_name) {
      updates.avatar_initials = getAvatarInitials(body.full_name)
    }

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    logger.info({ userId: user.id }, 'profile.updated')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ error: String(err) }, 'profile.update.failed')
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}

// Separate endpoint for password change — uses Supabase auth, not profiles table
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const parsed = await parseBody(req, ChangePasswordSchema)
    if (!parsed.success) return parsed.response

    const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    logger.info({ userId: user.id }, 'profile.password_changed')
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error({ error: String(err) }, 'profile.password.failed')
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 })
  }
}
