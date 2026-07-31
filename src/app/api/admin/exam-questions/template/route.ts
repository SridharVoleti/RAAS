import { NextResponse } from 'next/server'
import { getAdminUser, forbidden } from '@/lib/admin'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  const headers = ['Chapter', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer']
  const sampleRow = ['1', 'ప్రశ్న ఇక్కడ రాయండి?', 'ఎంపిక A', 'ఎంపిక B', 'ఎంపిక C', 'ఎంపిక D', 'a']

  // Prepend UTF-8 BOM so Excel opens and re-saves the file as UTF-8,
  // preserving Telugu characters.
  const csv = '﻿' + [
    headers.map(h => `"${h}"`).join(','),
    sampleRow.map(c => `"${c}"`).join(','),
  ].join('\r\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="exam-questions-template.csv"',
    },
  })
}
