// fontkit's Indic (Telugu) shaper needs regeneratorRuntime on the global scope
import 'regenerator-runtime/runtime'
import fs from 'fs'
import path from 'path'
import { PDFDocument, PDFFont, StandardFonts, degrees, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { formatInTimeZone } from 'date-fns-tz'
import type { CertificateData } from '@/lib/certificate'

// Text placement on the template, calibrated to certificate-template.jpg:
// cx = horizontal centre, baselineTop = baseline as a fraction of page height
// from the top, maxW = max text width in points before the size shrinks to fit.
const LAYOUT = {
  name:      { cx: 0.577, baselineTop: 0.556, size: 26, maxW: 350 },
  course:    { cx: 0.355, baselineTop: 0.619, size: 26, maxW: 350 },
  studentId: { cx: 0.202, baselineTop: 0.858, size: 20, maxW: 140 },
  date:      { cx: 0.190, baselineTop: 0.934, size: 18, maxW: 150 },
} as const

// Signature image: cx = horizontal centre, bottomTop = its bottom edge as a
// fraction of page height from the top (sits just above the signatory line).
// rotateDeg tilts it for a natural hand-signed look (counter-clockwise about
// its own centre, computed below so the tilt doesn't shift its position).
const SIGNATURE = { cx: 0.775, bottomTop: 0.868, width: 130, rotateDeg: 6 } as const

const PAGE_WIDTH = 842 // A4 landscape width in points; height follows the template's aspect ratio
const INK = rgb(0.12, 0.08, 0.3)
const LATIN_RE = /[A-Za-zÀ-ɏ]/

const ASSETS_DIR = path.join(process.cwd(), 'src', 'assets')

function readAsset(...segments: string[]): Buffer {
  return fs.readFileSync(path.join(ASSETS_DIR, ...segments))
}

// Noto Sans Telugu has no Latin letters, so split text into runs per script
function splitRuns(text: string): { latin: boolean; text: string }[] {
  const runs: { latin: boolean; text: string }[] = []
  for (const ch of text) {
    const latin = LATIN_RE.test(ch)
    const last = runs[runs.length - 1]
    if (last && last.latin === latin) last.text += ch
    else runs.push({ latin, text: ch })
  }
  return runs
}

export interface RenderOptions {
  /** Stamp a diagonal SPECIMEN watermark (admin test certificates) */
  specimen?: boolean
}

export async function renderCertificatePdf(cert: CertificateData, options: RenderOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const telugu = await doc.embedFont(readAsset('fonts', 'NotoSansTelugu-Bold.ttf'), { subset: true })
  const latin = await doc.embedFont(StandardFonts.TimesRomanBoldItalic)
  const template = await doc.embedJpg(readAsset('certificate-template.jpg'))
  const signature = await doc.embedPng(readAsset('signature.png'))

  const W = PAGE_WIDTH
  const H = Math.round(W * template.height / template.width)
  const page = doc.addPage([W, H])
  page.drawImage(template, { x: 0, y: 0, width: W, height: H })

  const fontFor = (run: { latin: boolean }): PDFFont => (run.latin ? latin : telugu)
  const measure = (runs: { latin: boolean; text: string }[], size: number) =>
    runs.reduce((w, r) => w + fontFor(r).widthOfTextAtSize(r.text, size), 0)

  function drawCentered(text: string, spec: { cx: number; baselineTop: number; size: number; maxW: number }) {
    const runs = splitRuns(text)
    let size = spec.size
    while (size > 8 && measure(runs, size) > spec.maxW) size -= 1
    let x = spec.cx * W - measure(runs, size) / 2
    const y = H - spec.baselineTop * H
    for (const r of runs) {
      const font = fontFor(r)
      page.drawText(r.text, { x, y, size, font, color: INK })
      x += font.widthOfTextAtSize(r.text, size)
    }
  }

  drawCentered(cert.studentName, LAYOUT.name)
  drawCentered(cert.courseTitleTe ?? cert.courseTitle, LAYOUT.course)
  if (cert.studentId) drawCentered(cert.studentId, LAYOUT.studentId)
  drawCentered(formatInTimeZone(new Date(cert.completedAt), 'Asia/Kolkata', 'dd/MM/yyyy'), LAYOUT.date)

  const sigWidth = SIGNATURE.width
  const sigHeight = sigWidth * (signature.height / signature.width)
  // pdf-lib rotates drawImage about its (x, y) anchor (the bottom-left corner
  // before rotation), so offset the anchor by the rotated centre so the
  // signature still lands on SIGNATURE.cx after tilting.
  const sigAngleRad = (SIGNATURE.rotateDeg * Math.PI) / 180
  const sigCenterDx = (sigWidth / 2) * Math.cos(sigAngleRad) - (sigHeight / 2) * Math.sin(sigAngleRad)
  page.drawImage(signature, {
    x: SIGNATURE.cx * W - sigCenterDx,
    y: H - SIGNATURE.bottomTop * H,
    width: sigWidth,
    height: sigHeight,
    rotate: degrees(SIGNATURE.rotateDeg),
  })

  if (options.specimen) {
    const text = 'SPECIMEN'
    const size = 96
    const angleDeg = 30
    const w = latin.widthOfTextAtSize(text, size)
    const rad = (angleDeg * Math.PI) / 180
    // baseline start so the rotated text is centred on the page
    page.drawText(text, {
      x: W / 2 - (w / 2) * Math.cos(rad),
      y: H / 2 - (w / 2) * Math.sin(rad) - size * 0.35,
      size,
      font: latin,
      color: rgb(0.55, 0.1, 0.1),
      opacity: 0.22,
      rotate: degrees(angleDeg),
    })
  }

  doc.setTitle('Certificate of Completion')
  doc.setAuthor('Sri Krishna Margam Trust — RAAS')

  return doc.save()
}
