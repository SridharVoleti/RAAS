import { NextResponse } from 'next/server'
import { getCertificate } from '@/lib/certificate'
import { renderCertificatePdf } from '@/lib/certificate-pdf'
import { logger } from '@/lib/logger'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  try {
    const { courseId } = await params
    const result = await getCertificate(Number(courseId))

    if (!result.ok) {
      const body: Record<string, unknown> = { error: result.error }
      if (result.progress !== undefined) body.progress = result.progress
      return NextResponse.json(body, { status: result.status })
    }

    const pdfBytes = await renderCertificatePdf(result.data)

    const inline = new URL(req.url).searchParams.get('inline') === '1'
    const safeName = result.data.studentName.replace(/[^A-Za-z0-9 _-]/g, '').trim() || 'certificate'
    const filename = `RAAS Certificate - ${safeName}.pdf`

    logger.info({ courseId }, 'certificate.pdf.generated')

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    logger.error({ error: String(err) }, 'certificate.pdf.failed')
    return NextResponse.json({ error: 'Failed to generate certificate PDF' }, { status: 500 })
  }
}
