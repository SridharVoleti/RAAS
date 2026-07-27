import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { renderCertificatePdf } from '@/lib/certificate-pdf'
import { logger } from '@/lib/logger'

/**
 * Admin test tool: generate a certificate PDF for any student/course,
 * bypassing eligibility checks. Never exposed to students.
 */
export async function GET(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  try {
    const { searchParams } = new URL(req.url)
    const courseId = Number(searchParams.get('courseId'))
    const userId = searchParams.get('userId')
    const customName = searchParams.get('name')?.trim()
    const date = searchParams.get('date')
    const specimen = searchParams.get('specimen') !== '0'

    if (!Number.isInteger(courseId) || courseId <= 0) {
      return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
    }
    if (!userId && !customName) {
      return NextResponse.json({ error: 'Provide a userId or a name' }, { status: 400 })
    }
    if (date && isNaN(Date.parse(date))) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: course } = await supabase
      .from('courses')
      .select('title_en, title_te, emoji')
      .eq('id', courseId)
      .single()
    if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

    let studentName = customName ?? ''
    let studentId: string | null = null
    if (!studentName && userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, student_id')
        .eq('id', userId)
        .single()
      if (!profile) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
      studentName = profile.full_name ?? 'Student'
      studentId = profile.student_id != null ? String(profile.student_id) : null
    }

    const pdfBytes = await renderCertificatePdf({
      studentName,
      studentId,
      courseTitle:   course.title_en ?? '',
      courseTitleTe: course.title_te ?? null,
      completedAt:   date ? new Date(date).toISOString() : new Date().toISOString(),
      emoji:         course.emoji ?? '📖',
      courseId,
      examScore:     null,
    }, { specimen })

    logger.info({ adminId: admin.id, courseId, specimen }, 'admin.certificate_preview.generated')

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="certificate-preview.pdf"',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    logger.error({ error: String(err) }, 'admin.certificate_preview.failed')
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 })
  }
}
