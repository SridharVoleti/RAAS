import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { getAwardedStudents } from '@/lib/certificate-awards'
import { logger } from '@/lib/logger'

function csvField(value: string | number | null): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Students awarded a certificate for one course; `?format=csv` downloads a CSV. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  try {
    const { courseId } = await params
    const id = Number(courseId)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid course id' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: course } = await supabase
      .from('courses')
      .select('id, slug, title_en, title_te, emoji')
      .eq('id', id)
      .single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    const students = await getAwardedStudents(id)

    const format = new URL(req.url).searchParams.get('format')
    if (format === 'csv') {
      const header = 'Student Name,Student ID,Track,Completed On,Exam Score'
      const rows = students.map(s => [
        csvField(s.studentName),
        csvField(s.studentId),
        csvField(s.track === 'exam' ? 'Final Exam' : 'Course'),
        csvField(s.completedAt ? s.completedAt.slice(0, 10) : ''),
        csvField(s.examScore),
      ].join(','))
      // BOM so Excel opens Telugu names correctly
      const csv = '﻿' + [header, ...rows].join('\r\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="certificates-${course.slug ?? id}.csv"`,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    return NextResponse.json({
      course: { id: course.id, title_en: course.title_en, title_te: course.title_te, emoji: course.emoji },
      students,
    })
  } catch (err) {
    logger.error({ error: String(err) }, 'admin.certificates.detail.failed')
    return NextResponse.json({ error: 'Failed to load awarded certificates' }, { status: 500 })
  }
}
