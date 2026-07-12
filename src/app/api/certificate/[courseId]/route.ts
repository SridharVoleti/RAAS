import { NextResponse } from 'next/server'
import { getCertificate } from '@/lib/certificate'
import { logger } from '@/lib/logger'

export async function GET(
  _req: Request,
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

    logger.info({ courseId }, 'certificate.generated')
    return NextResponse.json(result.data)
  } catch (err) {
    logger.error({ error: String(err) }, 'certificate.failed')
    return NextResponse.json({ error: 'Failed to generate certificate' }, { status: 500 })
  }
}
