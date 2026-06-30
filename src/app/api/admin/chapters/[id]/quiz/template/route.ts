import { NextResponse } from 'next/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { QUIZ_LANGUAGES, csvTemplateHeaders } from '@/lib/quiz-languages'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const headers = csvTemplateHeaders()

  // Sample row — one example per language column
  const sampleCells: string[] = []
  for (const lang of QUIZ_LANGUAGES) {
    sampleCells.push(`"Sample question in ${lang.label}?"`)
    sampleCells.push(`"Option A (${lang.label})"`)
    sampleCells.push(`"Option B (${lang.label})"`)
    sampleCells.push(`"Option C (${lang.label})"`)
    sampleCells.push(`"Option D (${lang.label})"`)
  }
  sampleCells.push('"b"')

  // Prepend UTF-8 BOM so Excel opens and re-saves the file as UTF-8,
  // preserving Telugu and other non-Latin characters.
  const csv = '﻿' + [
    headers.map(h => `"${h}"`).join(','),
    sampleCells.join(','),
  ].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="chapter-quiz-template.csv"',
    },
  })
}
