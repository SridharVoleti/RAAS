import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const supabase = await createAdminClient()

  const { data: current } = await supabase
    .from('courses')
    .select('is_published')
    .eq('id', Number(id))
    .single()

  const { data, error } = await supabase
    .from('courses')
    .update({ is_published: !current?.is_published })
    .eq('id', Number(id))
    .select('id, is_published')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
