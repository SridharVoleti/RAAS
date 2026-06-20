import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { csvRowToDbRecord, validateCsvRow } from '@/lib/quiz-languages'

const MAX_ROWS = 200

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const chapterId = Number(id)

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!Array.isArray(body) || body.length === 0) {
    return NextResponse.json({ error: 'Expected a non-empty array of rows' }, { status: 400 })
  }
  if (body.length > MAX_ROWS) {
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const { count: existing } = await supabase
    .from('quiz_questions')
    .select('*', { count: 'exact', head: true })
    .eq('chapter_id', chapterId)
  const startIndex = (existing ?? 0) + 1

  const records: Record<string, unknown>[] = []
  const errors: string[] = []

  for (let i = 0; i < body.length; i++) {
    const row = body[i] as Record<string, string>
    const err = validateCsvRow(row, i + 1)
    if (err) { errors.push(err); continue }
    records.push(csvRowToDbRecord(row, chapterId, startIndex + records.length))
  }

  if (records.length > 0) {
    const { error } = await supabase.from('quiz_questions').insert(records)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ imported: records.length, skipped: errors.length, errors })
}
