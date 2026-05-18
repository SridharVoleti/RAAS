import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { courseId, amount } = await req.json()
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Log payment attempt
    const { error } = await supabase.from('payment_logs').insert({
      user_id: user.id,
      course_id: courseId,
      amount: amount,
      status: 'created',
    })

    // Also create pending enrollment record
    await supabase.from('enrollments').upsert({
      user_id: user.id,
      course_id: courseId,
      is_active: false,
    }, { onConflict: 'user_id,course_id', ignoreDuplicates: true })

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Payment initiation failed' }, { status: 500 })
  }
}
