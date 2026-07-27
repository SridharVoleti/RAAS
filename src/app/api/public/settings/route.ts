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
  'intl_bank_account_holder',
  'intl_bank_name',
  'intl_account_number',
  'intl_swift_bic',
  'intl_iban',
  'intl_qr_url',
  'intl_payment_instructions',
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
