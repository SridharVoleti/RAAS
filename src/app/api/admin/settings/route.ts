import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser } from '@/lib/admin'
import { logger } from '@/lib/logger'

const ALLOWED_KEYS = [
  'bank_upi_id',
  'bank_account_holder',
  'bank_name',
  'bank_account_number',
  'bank_ifsc',
  'bank_qr_url',
  'welcome_video_url',
] as const

type SettingKey = typeof ALLOWED_KEYS[number]

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', ALLOWED_KEYS)

  if (error) {
    logger.error({ err: error }, 'admin.settings.get.failed')
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }

  const settings = Object.fromEntries((data ?? []).map(r => [r.key, r.value ?? '']))
  return NextResponse.json(settings)
}

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as Record<string, string> | null
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const upserts = Object.entries(body)
    .filter(([key]) => (ALLOWED_KEYS as readonly string[]).includes(key))
    .map(([key, value]) => ({
      key:  key as SettingKey,
      value: String(value),
      updated_at: new Date().toISOString(),
    }))

  if (upserts.length === 0) {
    return NextResponse.json({ error: 'No valid settings provided' }, { status: 400 })
  }

  const { error } = await supabase
    .from('site_settings')
    .upsert(upserts, { onConflict: 'key' })

  if (error) {
    logger.error({ err: error }, 'admin.settings.post.failed')
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  logger.info({ updatedKeys: upserts.map(u => u.key) }, 'admin.settings.saved')
  return NextResponse.json({ ok: true })
}
