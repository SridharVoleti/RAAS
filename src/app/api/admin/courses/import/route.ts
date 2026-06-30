import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { logger } from '@/lib/logger'

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  // Strip UTF-8 BOM that Excel adds when saving as "CSV UTF-8 (with BOM)"
  const normalized = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    const next = normalized[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') { cell += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cell += ch
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(cell); cell = '' }
      else if (ch === '\n') {
        row.push(cell); cell = ''
        if (row.some(c => c !== '')) rows.push(row)
        row = []
      } else {
        cell += ch
      }
    }
  }

  if (cell || row.length > 0) {
    row.push(cell)
    if (row.some(c => c !== '')) rows.push(row)
  }

  return rows
}

function csvToObjects(text: string): Record<string, string>[] {
  const [headerRow, ...dataRows] = parseCSV(text)
  if (!headerRow) return []
  const headers = headerRow.map(h => h.trim())
  return dataRows.map(row =>
    Object.fromEntries(headers.map((h, i) => [h, (row[i] ?? '').trim()]))
  )
}

function extractYouTubeId(input: string): string {
  const match = input.match(/(?:v=|\/embed\/|\.be\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : input.trim()
}

function csvEscape(val: string) {
  return `"${val.replace(/"/g, '""')}"`
}

// ── Template ──────────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  'path_id', 'slug', 'emoji', 'bg_color',
  'title_en', 'title_te',
  'description_en', 'description_te',
  'instructor_en', 'instructor_te',
  'category', 'level', 'badge', 'duration',
  'is_free', 'price', 'has_quiz', 'order_index',
  'section_title', 'lesson_title_en', 'lesson_title_te',
  'youtube_video_id', 'lesson_duration', 'is_preview',
]

const TEMPLATE_ROWS = [
  // Sample row 1 — course metadata + first lesson
  [
    '1', 'vedic-chanting-basics', '📖', '#1a0f00',
    'Vedic Chanting Basics', 'వైదిక జపం ప్రాథమికాలు',
    'Learn the foundational techniques of Vedic chanting in this comprehensive beginner course.',
    'ఈ కోర్సులో వైదిక జపం యొక్క ప్రాథమిక పద్ధతులు నేర్చుకోండి.',
    'Instructor Name', 'బోధకుడు పేరు',
    'Chanting', 'Beginner', 'New', '8 weeks',
    'false', '999', 'false', '1',
    'Introduction', 'Welcome & Overview', 'స్వాగతం & అవలోకనం', 'dQw4w9WgXcQ', '5:30', 'true',
  ],
  // Sample rows 2+ — lesson only (course columns left blank)
  [
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'Introduction', 'Chanting Basics Part 1', 'జపం ప్రాథమికాలు భాగం 1', 'ABC123xyz78', '10:45', 'false',
  ],
  [
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'Introduction', 'Chanting Basics Part 2', 'జపం ప్రాథమికాలు భాగం 2', 'XYZ789abc12', '12:00', 'false',
  ],
  [
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    'Advanced Techniques', 'Swara Patterns', 'స్వర విన్యాసాలు', 'MNO456pqr34', '15:20', 'false',
  ],
]

function buildTemplate(): string {
  // Prepend UTF-8 BOM so Excel opens and re-saves the file as UTF-8,
  // preserving Telugu and other non-Latin characters.
  const lines = [
    TEMPLATE_HEADERS.map(csvEscape).join(','),
    ...TEMPLATE_ROWS.map(row => row.map(csvEscape).join(',')),
  ]
  return '﻿' + lines.join('\n')
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  return new Response(buildTemplate(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="course_import_template.csv"',
    },
  })
}

export async function POST(req: Request) {
  logger.info('POST /api/admin/courses/import — request received')
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (!file.name.endsWith('.csv')) {
    return NextResponse.json({ error: 'File must be a .csv' }, { status: 400 })
  }

  const text = await file.text()
  const rows = csvToObjects(text)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV contains no data rows' }, { status: 400 })
  }

  // ── Course metadata from first row ────────────────────────────────────────
  const first = rows[0]

  const slug         = first.slug
  const title_en     = first.title_en
  const description_en = first.description_en

  if (!slug || !title_en || !description_en) {
    return NextResponse.json(
      { error: 'First row must include slug, title_en, and description_en' },
      { status: 400 }
    )
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: `Invalid slug "${slug}" — use only lowercase letters, digits, and hyphens` },
      { status: 400 }
    )
  }

  const level = first.level as 'Beginner' | 'Intermediate' | 'Advanced'
  if (!['Beginner', 'Intermediate', 'Advanced'].includes(level)) {
    return NextResponse.json(
      { error: `Invalid level "${level}" — must be Beginner, Intermediate, or Advanced` },
      { status: 400 }
    )
  }

  const coursePayload = {
    path_id:        parseInt(first.path_id) || 1,
    slug,
    emoji:          first.emoji || '📖',
    bg_color:       /^#[0-9a-fA-F]{6}$/.test(first.bg_color) ? first.bg_color : '#1a0f00',
    title_en,
    title_te:       first.title_te || '',
    description_en,
    description_te: first.description_te || '',
    instructor_en:  first.instructor_en || '',
    instructor_te:  first.instructor_te || '',
    category:       first.category || 'Scripture',
    level,
    badge:          ['Popular', 'New', 'Free'].includes(first.badge) ? first.badge : null,
    duration:       first.duration || '4 weeks',
    is_free:        first.is_free?.toLowerCase() === 'true',
    price:          first.is_free?.toLowerCase() === 'true' ? 0 : (parseFloat(first.price) || 0),
    has_quiz:       first.has_quiz?.toLowerCase() === 'true',
    order_index:    parseInt(first.order_index) || 0,
    is_published:   false,
  }

  // ── Lessons from all rows ─────────────────────────────────────────────────
  const lessonRows = rows.filter(
    r => r.lesson_title_en?.trim() && r.youtube_video_id?.trim()
  )

  if (lessonRows.length === 0) {
    return NextResponse.json(
      { error: 'No lesson rows found — each lesson row needs lesson_title_en and youtube_video_id' },
      { status: 400 }
    )
  }

  const supabase = await createAdminClient()

  // ── Insert course ─────────────────────────────────────────────────────────
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .insert(coursePayload)
    .select()
    .single()

  if (courseError) {
    logger.error({ err: courseError }, 'course import — course insert failed')
    return NextResponse.json({ error: courseError.message }, { status: 500 })
  }

  logger.info({ courseId: course.id, slug: course.slug }, 'course import — course created')

  // ── Insert lessons ────────────────────────────────────────────────────────
  const lessonPayloads = lessonRows.map((r, i) => ({
    course_id:        course.id,
    chapter_id:       null,
    section_title:    r.section_title || null,
    title_en:         r.lesson_title_en.trim(),
    title_te:         r.lesson_title_te?.trim() || null,
    youtube_video_id: extractYouTubeId(r.youtube_video_id.trim()),
    duration:         r.lesson_duration?.trim() || null,
    order_index:      i + 1,
    is_preview:       r.is_preview?.toLowerCase() === 'true',
  }))

  const { error: lessonsError } = await supabase.from('lessons').insert(lessonPayloads)

  if (lessonsError) {
    logger.error({ err: lessonsError, courseId: course.id }, 'course import — lessons insert failed')
    return NextResponse.json(
      { course, lessons_created: 0, warning: lessonsError.message },
      { status: 207 }
    )
  }

  logger.info({ courseId: course.id, count: lessonPayloads.length }, 'course import — lessons created')

  revalidatePath('/explore')
  revalidatePath('/')

  return NextResponse.json(
    { course, lessons_created: lessonPayloads.length },
    { status: 201 }
  )
}
