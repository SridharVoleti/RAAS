import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const RowSchema = z.object({
  category_key:   z.string().min(1),
  difficulty:     z.union([z.literal(1), z.literal(2), z.literal(3)]),
  question_en:    z.string().max(2000).optional().default(''),
  question_te:    z.string().max(2000).optional().default(''),
  option_a_en:    z.string().max(500).optional().default(''),
  option_a_te:    z.string().max(500).optional().default(''),
  option_b_en:    z.string().max(500).optional().default(''),
  option_b_te:    z.string().max(500).optional().default(''),
  option_c_en:    z.string().max(500).optional().default(''),
  option_c_te:    z.string().max(500).optional().default(''),
  option_d_en:    z.string().max(500).optional().default(''),
  option_d_te:    z.string().max(500).optional().default(''),
  correct_option: z.enum(['a', 'b', 'c', 'd']),
}).superRefine((d, ctx) => {
  if (!d.question_en?.trim() && !d.question_te?.trim())
    ctx.addIssue({ code: 'custom', message: 'At least one language question is required', path: ['question_en'] })
  for (const opt of ['a', 'b', 'c', 'd'] as const) {
    const en = d[`option_${opt}_en` as keyof typeof d] as string
    const te = d[`option_${opt}_te` as keyof typeof d] as string
    if (!en?.trim() && !te?.trim())
      ctx.addIssue({ code: 'custom', message: `At least one language text for option ${opt} is required`, path: [`option_${opt}_en`] })
  }
})

const ImportSchema = z.object({
  categoryKey: z.string().min(1),
  rows:        z.array(z.record(z.string(), z.unknown())).min(1).max(500),
})

function normaliseCorrectOption(val: unknown): string {
  if (typeof val !== 'string') return String(val ?? '').toLowerCase().trim()
  const v = val.toLowerCase().trim()
  // accept "A", "Option A", "a", "1" → "a" etc.
  if (['a', 'b', 'c', 'd'].includes(v)) return v
  const map: Record<string, string> = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', 'option a': 'a', 'option b': 'b', 'option c': 'c', 'option d': 'd' }
  return map[v] ?? v
}

function normaliseDifficulty(val: unknown): number {
  if (typeof val === 'number') return val
  const s = String(val ?? '').toLowerCase().trim()
  const map: Record<string, number> = { '1': 1, 'easy': 1, '2': 2, 'medium': 2, '3': 3, 'hard': 3 }
  return map[s] ?? 2
}

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = ImportSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }
  const { categoryKey, rows } = parsed.data

  const inserted: object[] = []
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i] as Record<string, unknown>

    // Normalise before validation
    const normalised = {
      category_key:   categoryKey,
      difficulty:     normaliseDifficulty(raw.difficulty ?? raw.Difficulty),
      question_en:    String(raw.question_en ?? raw['Question (English)'] ?? raw.question ?? '').trim(),
      question_te:    String(raw.question_te ?? raw['Question (Telugu)'] ?? '').trim(),
      option_a_en:    String(raw.option_a_en ?? raw['Option A (English)'] ?? raw.option_a ?? '').trim(),
      option_a_te:    String(raw.option_a_te ?? raw['Option A (Telugu)'] ?? '').trim(),
      option_b_en:    String(raw.option_b_en ?? raw['Option B (English)'] ?? raw.option_b ?? '').trim(),
      option_b_te:    String(raw.option_b_te ?? raw['Option B (Telugu)'] ?? '').trim(),
      option_c_en:    String(raw.option_c_en ?? raw['Option C (English)'] ?? raw.option_c ?? '').trim(),
      option_c_te:    String(raw.option_c_te ?? raw['Option C (Telugu)'] ?? '').trim(),
      option_d_en:    String(raw.option_d_en ?? raw['Option D (English)'] ?? raw.option_d ?? '').trim(),
      option_d_te:    String(raw.option_d_te ?? raw['Option D (Telugu)'] ?? '').trim(),
      correct_option: normaliseCorrectOption(raw.correct_option ?? raw['Correct Option'] ?? raw.correct ?? ''),
    }

    const result = RowSchema.safeParse(normalised)
    if (!result.success) {
      const msg = Object.values(result.error.flatten().fieldErrors).flat().join('; ')
      errors.push({ row: i + 2, message: msg }) // +2: 1-indexed + header row
      continue
    }

    inserted.push(result.data)
  }

  if (inserted.length === 0) {
    return NextResponse.json({ error: 'No valid rows to import', errors }, { status: 422 })
  }

  const adminSupa = await createAdminClient()
  const { data, error: dbErr } = await adminSupa
    .from('prior_learning_exam_questions')
    .insert(inserted)
    .select('id')

  if (dbErr) {
    logger.error({ error: dbErr.message, admin: admin.email }, 'pl_exam_q.import.db_error')
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  logger.info({ count: data?.length, admin: admin.email, categoryKey }, 'pl_exam_q.imported')
  return NextResponse.json({ inserted: data?.length ?? 0, skipped: errors.length, errors })
}
