import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { parseBody, EmailTemplateSchema } from '@/lib/validation'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { type } = await params
  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('email_templates')
    .select('type, subject, body, updated_at')
    .eq('type', type)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const parsed = await parseBody(req, EmailTemplateSchema)
  if (!parsed.success) return parsed.response
  const { subject, body } = parsed.data

  const { type } = await params
  const supabase = await createAdminClient()

  const { error } = await supabase
    .from('email_templates')
    .upsert({ type, subject: subject.trim(), body: body.trim(), updated_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
