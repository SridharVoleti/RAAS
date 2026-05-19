export type Language = 'en' | 'te'

export interface Path {
  id: number
  slug: string
  name: string
  emoji: string
  tagline_en: string
  tagline_te: string
  description_en: string
  description_te: string
  is_active: boolean
  order_index: number
}

export interface Course {
  id: number
  path_id: number
  slug: string
  emoji: string
  bg_color: string
  title_en: string
  title_te: string
  description_en: string
  description_te: string
  instructor_en: string
  instructor_te: string
  category: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  badge: 'Popular' | 'New' | 'Free'
  duration: string
  is_free: boolean
  price: number
  rating: number
  review_count: number
  student_count: number
  has_quiz: boolean
  order_index: number
  is_published: boolean
  curriculum?: string[]
}

export interface Lesson {
  id: number
  course_id: number
  section_title?: string
  title_en: string
  title_te?: string
  youtube_video_id: string
  duration?: string
  order_index: number
  is_preview: boolean
}

export interface Profile {
  id: string
  full_name: string
  mobile?: string
  isd_code: string
  city?: string
  country: string
  avatar_initials: string
  is_admin: boolean
  preferred_lang: Language
  profile_complete: boolean
}

export interface Enrollment {
  id: number
  user_id: string
  course_id: number
  enrolled_at: string
  is_active: boolean
  activated_at?: string
}

export interface UserProgress {
  user_id: string
  course_id: number
  lesson_id: number
  completed_at: string
}

export interface Testimonial {
  id: number
  reviewer_name: string
  content_en: string
  content_te?: string
  rating: number
  course_id?: number
  created_at: string
}

export interface PaymentLog {
  id: number
  user_id: string
  course_id: number
  razorpay_order_id?: string
  razorpay_payment_id?: string
  amount: number
  status: 'created' | 'paid' | 'failed'
  created_at: string
}

export interface CourseWithProgress extends Course {
  progress_pct: number
  completed_lessons: number
  total_lessons: number
  enrolled_at: string
  activated_at?: string
}
