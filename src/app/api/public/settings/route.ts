import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

const PUBLIC_KEYS = [
  'bank_upi_id',
  'bank_account_holder',
  'bank_name',
  'bank_account_number',
  'bank_ifsc',
  'bank_qr_url',
  'welcome_video_url',
]

export async function GET() {
  const supabase = await createAdminClient()
  const { data } = await supabase
    .from('site_settings')
    .select('key, value')
    .in('key', PUBLIC_KEYS)

  const settings = Object.fromEntries((data ?? []).map(r => [r.key, r.value ?? '']))
  return NextResponse.json(settings)
}
