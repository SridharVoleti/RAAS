import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { QUIZ_LANGUAGES } from '@/lib/quiz-languages'

function csvEscape(val: string) {
  return `"${val.replace(/"/g, '""')}"`
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const { id } = await params
  const courseId = Number(id)
  const supabase = await createAdminClient()

  // Validate course exists
  const { data: course } = await supabase
    .from('courses')
    .select('id, title_en')
    .eq('id', courseId)
    .single()

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  // Fetch chapters for this course so we can pre-fill sample rows
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, title_en')
    .eq('course_id', courseId)
    .order('order_index')

  // Build header row
  const langCols: string[] = []
  for (const lang of QUIZ_LANGUAGES) {
    langCols.push(`question_${lang.code}`)
    langCols.push(`option_a_${lang.code}`)
    langCols.push(`option_b_${lang.code}`)
    langCols.push(`option_c_${lang.code}`)
    langCols.push(`option_d_${lang.code}`)
  }
  const headers = ['chapter_id', ...langCols, 'correct_option']

  // Build sample rows — one per existing chapter, or two generic rows if no chapters yet
  const sampleRows: string[][] = []

  if (chapters && chapters.length > 0) {
    for (const ch of chapters) {
      const row: string[] = [String(ch.id)]
      for (const lang of QUIZ_LANGUAGES) {
        row.push(`Sample question for ${ch.title_en}?`)
        row.push(`Option A`)
        row.push(`Option B`)
        row.push(`Option C (correct)`)
        row.push(`Option D`)
      }
      row.push('c')
      sampleRows.push(row)
    }
  } else {
    // No chapters yet — show two generic sample rows with placeholder IDs
    for (const chId of [1, 1]) {
      const row: string[] = [String(chId)]
      for (const lang of QUIZ_LANGUAGES) {
        row.push(`Sample question in ${lang.label}?`)
        row.push(`Option A (${lang.label})`)
        row.push(`Option B (${lang.label})`)
        row.push(`Option C (${lang.label}) — correct`)
        row.push(`Option D (${lang.label})`)
      }
      row.push('c')
      sampleRows.push(row)
    }
  }

  const csvLines = [
    headers.map(csvEscape).join(','),
    ...sampleRows.map(row => row.map(csvEscape).join(',')),
  ]

  // Append a reference block so users know which chapter_id maps to which chapter
  if (chapters && chapters.length > 0) {
    csvLines.push('')
    csvLines.push(csvEscape('chapter_id reference (do not edit below this line)') + ',' + csvEscape('chapter title'))
    for (const ch of chapters) {
      csvLines.push(csvEscape(String(ch.id)) + ',' + csvEscape(ch.title_en))
    }
  }

  const filename = `quiz-questions-course-${courseId}.csv`

  // Prepend UTF-8 BOM so Excel opens and re-saves the file as UTF-8,
  // preserving Telugu and other non-Latin characters.
  return new NextResponse('﻿' + csvLines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
