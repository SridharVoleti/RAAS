'use client'

import { useLang } from '@/contexts/LanguageContext'
import { formatPrice } from '@/lib/utils'
import { BADGE_STYLES } from '@/lib/badges'
import type { Course } from '@/types'
import { Star } from 'lucide-react'

interface CourseCardProps {
  course: Course
  onClick: (course: Course) => void
  isEnrolled?: boolean
}

export default function CourseCard({ course, onClick, isEnrolled }: CourseCardProps) {
  const { lang, t } = useLang()
  const title = lang === 'te' ? course.title_te : course.title_en
  const subtitle = lang === 'te' ? course.title_en : course.title_te
  const instructor = lang === 'te' ? course.instructor_te : course.instructor_en

  return (
    <div
      onClick={() => onClick(course)}
      className="bg-brand-card border border-brand-border rounded-xl overflow-hidden cursor-pointer hover:border-brand-gold transition-all duration-200 hover:shadow-lg hover:shadow-brand-gold/10 group"
    >
      {/* Emoji thumbnail */}
      <div
        className="h-32 flex items-center justify-center text-6xl relative overflow-hidden"
        style={{ backgroundColor: course.bg_color }}
      >
        {course.resources?.[0]?.url ? (
          <a
            href={course.resources[0].url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="group-hover:scale-110 transition-transform duration-200"
            title={course.resources[0].title}
          >
            {course.emoji}
          </a>
        ) : (
          <span className="group-hover:scale-110 transition-transform duration-200">{course.emoji}</span>
        )}
        {/* Badge */}
        {course.badge && (
          <div className={`absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-bold ${BADGE_STYLES[course.badge]}`}>
            {course.badge === 'Free' ? t.course.free : course.badge === 'Coming Soon' ? t.course.comingSoon : course.badge}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-brand-gold font-semibold text-sm leading-snug mb-0.5 line-clamp-2">
          {title}
        </h3>
        {subtitle && (
          <p className="text-brand-gold-muted text-xs mb-2 line-clamp-1">{subtitle}</p>
        )}

        {/* Instructor */}
        <p className="text-brand-body text-xs mb-3">
          {instructor}
        </p>

        {/* Rating row */}
        <div className="flex items-center gap-1 mb-3">
          <Star className="w-3.5 h-3.5 fill-brand-gold text-brand-gold" />
          <span className="text-brand-gold text-xs font-semibold">{course.rating}</span>
          <span className="text-brand-gold-muted text-xs">({course.review_count})</span>
          <span className="text-brand-gold-muted text-xs ml-auto">{course.duration}</span>
        </div>

        {/* Student count */}
        <p className="text-brand-gold-muted text-xs mb-3">
          {course.student_count.toLocaleString()} {t.course.students}
        </p>

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className={`font-bold text-sm ${course.is_free ? 'text-brand-success' : 'text-brand-gold'}`}>
            {formatPrice(course.price)}
          </span>
          <button className="px-3 py-1 bg-brand-gold text-brand-bg text-xs font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
            {isEnrolled ? t.course.continueLearning : t.course.enroll}
          </button>
        </div>
      </div>
    </div>
  )
}
