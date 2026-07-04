export type Language = 'en' | 'te'

export type RazorpayOptions = {
  key: string; amount: number; currency: string; name: string
  description: string; order_id: string
  handler: (response?: { razorpay_payment_id: string; razorpay_order_id: string }) => void
  prefill?: { email?: string }
  theme?: { color?: string }
  modal?: { ondismiss?: () => void }
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void }
  }
}

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
  has_exam?: boolean
  order_index: number
  is_published: boolean
  curriculum?: string[]
}

export interface Chapter {
  id: number
  course_id: number
  title_en: string
  title_te?: string
  order_index: number
  created_at: string
}

export interface Lesson {
  id: number
  course_id: number
  chapter_id?: number
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

export interface QuizQuestion {
  id: number
  lesson_id?: number
  chapter_id?: number
  question_en: string
  question_te?: string
  option_a_en: string
  option_a_te?: string
  option_b_en: string
  option_b_te?: string
  option_c_en: string
  option_c_te?: string
  option_d_en: string
  option_d_te?: string
  correct_option: 'a' | 'b' | 'c' | 'd'
  order_index: number
}

export type QuizQuestion_Public = Omit<QuizQuestion, 'correct_option'>

export interface QuizSubmission {
  id: number
  user_id: string
  lesson_id?: number
  chapter_id?: number
  score: number
  total_questions: number
  submitted_at: string
}

export interface QuizResult {
  score: number
  total: number
  results: Record<number, { correct: boolean; correct_option: 'a' | 'b' | 'c' | 'd' }>
}

export interface ExamQuestion {
  id: number
  course_id: number
  chapter_id?: number
  chapter_name?: string
  difficulty: 1 | 2 | 3
  question_en: string
  question_te?: string
  option_a_en: string
  option_a_te?: string
  option_b_en: string
  option_b_te?: string
  option_c_en: string
  option_c_te?: string
  option_d_en: string
  option_d_te?: string
  correct_option: 'a' | 'b' | 'c' | 'd'
  created_at: string
}

export type ExamQuestion_Public = Omit<ExamQuestion, 'correct_option'>

export interface ExamSession {
  id: string
  user_id: string
  course_id: number
  session_type: 'course' | 'exam_only'
  status: 'in_progress' | 'submitted'
  question_sequence: number[]
  answers: Record<string, 'a' | 'b' | 'c' | 'd'>
  current_difficulty: 1 | 2 | 3
  questions_answered: number
  score: number | null
  passed: boolean | null
  started_at: string
  submitted_at: string | null
}

export interface ExamNextQuestion {
  question: ExamQuestion_Public
  question_number: number
  total_questions: number
  done: false
}

export interface ExamComplete {
  done: true
  score: number
  total: number
  passed: boolean
  session_id: string
}

export type ExamNextResponse = ExamNextQuestion | ExamComplete

export interface TextWidget {
  id: number
  title: string
  content: string
  position: 'announcement' | 'home-section'
  is_active: boolean
  created_at: string
}


export interface CourseWithProgress extends Course {
  progress_pct: number
  completed_lessons: number
  total_lessons: number
  enrolled_at: string
  activated_at?: string
}
