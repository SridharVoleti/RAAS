import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAdminUser } from '@/lib/admin'
import { renderReceiptPdf } from '@/lib/receipt-pdf'
import { logger } from '@/lib/logger'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const purchaseId = Number(id)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = createAdminClient()
  const { data: purchase } = await adminSupabase
    .from('course_purchases')
    .select('user_id, amount_usd, status, receipt_number, confirmed_at, courses ( title_en )')
    .eq('id', purchaseId)
    .single()

  if (!purchase) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })

  const admin = await getAdminUser()
  if (purchase.user_id !== user.id && !admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (purchase.status !== 'confirmed' || !purchase.receipt_number) {
    return NextResponse.json({ error: 'Receipt not available — payment not yet confirmed' }, { status: 404 })
  }

  const { data: profile } = await adminSupabase
    .from('profiles')
    .select('full_name')
    .eq('id', purchase.user_id)
    .single()

  try {
    const pdfBytes = await renderReceiptPdf({
      receiptNumber: purchase.receipt_number,
      studentName:   profile?.full_name ?? 'Student',
      courseTitle:   (purchase.courses as unknown as { title_en?: string } | null)?.title_en ?? '',
      amountUsd:     Number(purchase.amount_usd),
      paidAt:        purchase.confirmed_at ?? new Date().toISOString(),
    })

    const inline = new URL(req.url).searchParams.get('inline') === '1'

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="Receipt-${purchase.receipt_number}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    logger.error({ error: String(err), purchaseId }, 'course_purchase.receipt.failed')
    return NextResponse.json({ error: 'Failed to generate receipt' }, { status: 500 })
  }
}
