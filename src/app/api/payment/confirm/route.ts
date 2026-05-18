import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { paymentLogId, userId, courseId } = await req.json()
    const supabase = await createAdminClient()

    // Update payment log
    await supabase
      .from('payment_logs')
      .update({ status: 'paid' })
      .eq('id', paymentLogId)

    // Activate enrollment
    await supabase.from('enrollments').upsert({
      user_id: userId,
      course_id: courseId,
      is_active: true,
      activated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id' })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Confirmation failed' }, { status: 500 })
  }
}
