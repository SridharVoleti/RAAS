import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { formatInTimeZone } from 'date-fns-tz'

export interface ReceiptData {
  receiptNumber: string
  studentName:   string
  courseTitle:   string
  amountUsd:     number
  paidAt:        string
}

const INK       = rgb(0.12, 0.08, 0.3)
const MUTED     = rgb(0.45, 0.42, 0.5)
const PAGE_W    = 595 // A4 portrait, points
const PAGE_H    = 842

export async function renderReceiptPdf(receipt: ReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([PAGE_W, PAGE_H])
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold)
  const regular = await doc.embedFont(StandardFonts.Helvetica)

  let y = PAGE_H - 80

  page.drawText('Sri Krishnamargam Trust', { x: 60, y, size: 20, font: bold, color: INK })
  y -= 26
  page.drawText('Payment Receipt', { x: 60, y, size: 13, font: regular, color: MUTED })
  y -= 50

  const row = (label: string, value: string) => {
    page.drawText(label, { x: 60, y, size: 11, font: regular, color: MUTED })
    page.drawText(value, { x: 220, y, size: 11, font: bold, color: INK })
    y -= 26
  }

  row('Receipt No.',    receipt.receiptNumber)
  row('Date',            formatInTimeZone(new Date(receipt.paidAt), 'Asia/Kolkata', 'dd MMM yyyy'))
  row('Student',         receipt.studentName)
  row('Course',          receipt.courseTitle)
  row('Amount Paid',     `USD $${receipt.amountUsd.toFixed(2)}`)
  row('Payment Method',  'International Bank Transfer / QR')

  y -= 20
  page.drawLine({ start: { x: 60, y }, end: { x: PAGE_W - 60, y }, thickness: 0.5, color: MUTED })
  y -= 30

  page.drawText(
    'This receipt confirms payment received for course access on the Sri Krishnamargam',
    { x: 60, y, size: 9, font: regular, color: MUTED },
  )
  y -= 14
  page.drawText(
    'learning platform. This is a sale of course access, not a donation.',
    { x: 60, y, size: 9, font: regular, color: MUTED },
  )

  doc.setTitle(`Receipt ${receipt.receiptNumber}`)
  doc.setAuthor('Sri Krishnamargam Trust')

  return doc.save()
}
