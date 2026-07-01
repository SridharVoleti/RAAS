import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { QUIZ_LANGUAGES } from '@/lib/quiz-languages'

const MAX_ROWS = 500

// ── Lightweight RFC-4180 CSV parser ──────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM that Excel adds when saving as "CSV UTF-8 (with BOM)"
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')

  function splitLine(line: string): string[] {
    const cols: string[] = []
    let cell = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      const next = line[i + 1]
      if (inQuotes) {
        if (ch === '"' && next === '"') { cell += '"'; i++ }
        else if (ch === '"') inQuotes = false
        else cell += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') { cols.push(cell.trim()); cell = '' }
        else cell += ch
      }
    }
    cols.push(cell.trim())
    return cols
  }

  const nonEmpty = lines.filter(l => l.trim())
  if (nonEmpty.length < 2) return []
  const headers = splitLine(nonEmpty[0]).map(h => h.trim())

  const rows: Record<string, string>[] = []
  for (const line of nonEmpty.slice(1)) {
    const vals = splitLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim() })
    // Skip reference block rows (chapter_id is not a number)
    const rawChapterId = row['chapter_id'] ?? ''
    if (!rawChapterId || isNaN(Number(rawChapterId))) continue
    rows.push(row)
  }
  return rows
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const courseId = Number(id)

  // Parse multipart form data
  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0)
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (!file.name.toLowerCase().endsWith('.csv'))
    return NextResponse.json({ error: 'File must be a .csv' }, { status: 400 })

  const text = await file.text()
  const rows = parseCSV(text)

  if (rows.length === 0)
    return NextResponse.json({ error: 'No data rows found in CSV' }, { status: 400 })
  if (rows.length > MAX_ROWS)
    return NextResponse.json({ error: `Maximum ${MAX_ROWS} rows per import` }, { status: 400 })

  const supabase = await createAdminClient()

  // Validate course exists
  const { data: course } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .single()
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  // Fetch all chapters for this course → valid chapter_id set
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id')
    .eq('course_id', courseId)

  const validChapterIds = new Set((chapters ?? []).map(c => c.id))

  // Collect unique chapter_ids referenced in the CSV
  const referencedChapterIds = new Set<number>()
  for (const row of rows) {
    const cid = Number(row['chapter_id'])
    if (!isNaN(cid) && cid > 0) referencedChapterIds.add(cid)
  }

  // Fetch existing questions for all referenced chapters (for dedup, using first non-empty language)
  const { data: existingQuestions } = referencedChapterIds.size > 0
    ? await supabase
        .from('quiz_questions')
        .select('chapter_id, question_en, question_te')
        .in('chapter_id', [...referencedChapterIds])
    : { data: [] }

  // Build a dedup key set: "chapterId:normalised_question" (first non-empty language)
  const existingKeys = new Set<string>()
  for (const q of (existingQuestions ?? [])) {
    const text = (q.question_en || q.question_te || '').trim().toLowerCase()
    if (q.chapter_id && text) {
      existingKeys.add(`${q.chapter_id}:${text}`)
    }
  }

  // Get current question counts per chapter so we can assign order_index
  const { data: countRows } = referencedChapterIds.size > 0
    ? await supabase
        .from('quiz_questions')
        .select('chapter_id')
        .in('chapter_id', [...referencedChapterIds])
    : { data: [] }

  const chapterCounts: Record<number, number> = {}
  for (const r of (countRows ?? [])) {
    if (r.chapter_id) chapterCounts[r.chapter_id] = (chapterCounts[r.chapter_id] ?? 0) + 1
  }

  // Process rows
  const toInsert: Record<string, unknown>[] = []
  const errors: string[] = []
  let skippedDuplicates = 0
  let skippedInvalidChapter = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 1

    const chapterId = Number(row['chapter_id'])
    const correct = row['correct_option']?.trim().toLowerCase()

    // Validate chapter belongs to this course
    if (!validChapterIds.has(chapterId)) {
      errors.push(`Row ${rowNum}: chapter_id ${chapterId} does not belong to this course`)
      skippedInvalidChapter++
      continue
    }

    // At least one language must supply question and all four options
    const hasCompleteLang = QUIZ_LANGUAGES.some(lang =>
      row[`question_${lang.code}`]?.trim() &&
      row[`option_a_${lang.code}`]?.trim() &&
      row[`option_b_${lang.code}`]?.trim() &&
      row[`option_c_${lang.code}`]?.trim() &&
      row[`option_d_${lang.code}`]?.trim()
    )
    if (!hasCompleteLang) {
      errors.push(`Row ${rowNum}: at least one complete language set (question + all 4 options) is required`)
      continue
    }
    if (!['a', 'b', 'c', 'd'].includes(correct)) {
      errors.push(`Row ${rowNum}: correct_option must be a, b, c, or d`)
      continue
    }

    // Duplicate check using first non-empty language question
    const questionText = (row['question_en']?.trim() || row['question_te']?.trim() || '').toLowerCase()
    const dedupKey = `${chapterId}:${questionText}`
    if (existingKeys.has(dedupKey)) {
      skippedDuplicates++
      continue
    }

    // Build record
    const orderIndex = (chapterCounts[chapterId] ?? 0) + toInsert.filter(r => r.chapter_id === chapterId).length + 1

    const record: Record<string, unknown> = {
      chapter_id:     chapterId,
      correct_option: correct,
      order_index:    orderIndex,
    }
    for (const lang of QUIZ_LANGUAGES) {
      record[`question_${lang.code}`] = row[`question_${lang.code}`]?.trim() || null
      record[`option_a_${lang.code}`] = row[`option_a_${lang.code}`]?.trim() || null
      record[`option_b_${lang.code}`] = row[`option_b_${lang.code}`]?.trim() || null
      record[`option_c_${lang.code}`] = row[`option_c_${lang.code}`]?.trim() || null
      record[`option_d_${lang.code}`] = row[`option_d_${lang.code}`]?.trim() || null
    }

    // Mark as seen so the same question appearing twice in the CSV is also deduped
    existingKeys.add(dedupKey)
    toInsert.push(record)
  }

  // Batch insert
  if (toInsert.length > 0) {
    const { error } = await supabase.from('quiz_questions').insert(toInsert)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    imported:                 toInsert.length,
    skipped_duplicates:       skippedDuplicates,
    skipped_invalid_chapter:  skippedInvalidChapter,
    errors,
  })
}
