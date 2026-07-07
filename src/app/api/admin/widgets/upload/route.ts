import { NextResponse } from 'next/server'
import { getAdminUser, forbidden } from '@/lib/admin'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const BUCKET          = 'widget-images'
const MAX_SIZE        = 5 * 1024 * 1024   // 5 MB
const ALLOWED_TYPES   = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const ALLOWED_EXTS    = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif'])

export async function POST(req: Request) {
  const admin = await getAdminUser()
  if (!admin) return forbidden()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const ext = file?.name.split('.').pop()?.toLowerCase() ?? ''
  if (!file || !ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: 'Please upload a valid image file (jpg, png, webp, gif).' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be under 5 MB.' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Create the bucket if it doesn't exist yet (idempotent)
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})

  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) {
    logger.error({ error, admin: admin.email }, 'admin.widgets.upload.error')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(data.path)

  logger.info({ path: data.path, admin: admin.email }, 'admin.widgets.upload.ok')
  return NextResponse.json({ url: publicUrl })
}
