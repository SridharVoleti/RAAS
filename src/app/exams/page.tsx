'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, BookOpen } from 'lucide-react'
import { useLang } from '@/contexts/LanguageContext'
import { RAMANUJA_GRANTHA_CONFIG } from '@/lib/priorLearningConfigs'

interface Declaration {
  id: number
  category_key: string
  book_name: string
  teacher_name: string
  created_at: string
}

const CONFIG_MAP = {
  [RAMANUJA_GRANTHA_CONFIG.categoryKey]: RAMANUJA_GRANTHA_CONFIG,
}

export default function ExamsPage() {
  const router = useRouter()
  const { lang } = useLang()
  const [declarations, setDeclarations] = useState<Declaration[]>([])
  const [loading, setLoading] = useState(true)
  const te = lang === 'te'

  useEffect(() => {
    fetch('/api/prior-learning')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.declarations) setDeclarations(d.declarations) })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-5xl animate-pulse">ॐ</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-brand-gold font-bold text-2xl mb-1">
          {te ? 'పూర్వ అభ్యాస పరీక్షలు' : 'Prior Learning Exams'}
        </h1>
        <p className="text-brand-gold-muted text-sm mb-8">
          {te
            ? 'మీరు నేర్చుకున్న విషయాలపై మీ జ్ఞానాన్ని 1 గంట పరీక్షలో నిరూపించుకోండి.'
            : 'Demonstrate your knowledge on subjects you have already learnt with a 1-hour timed exam.'}
        </p>

        {declarations.length === 0 ? (
          <div className="bg-brand-card border border-brand-border rounded-2xl p-8 text-center">
            <BookOpen className="w-12 h-12 text-brand-gold-muted mx-auto mb-3" />
            <p className="text-brand-gold-muted text-sm">
              {te
                ? 'మీరు ఇంకా పూర్వ అభ్యాసాన్ని నమోదు చేయలేదు. హోమ్ పేజీలో నమోదు చేయండి.'
                : 'No prior learning declarations yet. Declare your prior learning from the home page.'}
            </p>
            <button
              onClick={() => router.push('/')}
              className="mt-4 px-4 py-2 text-sm text-brand-gold border border-brand-gold rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors"
            >
              {te ? 'హోమ్‌కు వెళ్ళు' : 'Go to Home'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {declarations.map(decl => {
              const config = CONFIG_MAP[decl.category_key]
              const name = config
                ? (te ? config.categoryName.te : config.categoryName.en)
                : decl.category_key

              return (
                <div
                  key={decl.id}
                  className="bg-brand-card border border-brand-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <h2 className="text-brand-gold font-semibold text-base mb-0.5">{name}</h2>
                    <p className="text-brand-gold-muted text-xs">
                      {te ? 'గ్రంథం:' : 'Book:'} {decl.book_name}
                    </p>
                    <div className="flex flex-wrap gap-3 mt-2.5">
                      <span className="text-brand-gold-muted text-xs bg-brand-bg border border-brand-border rounded-full px-3 py-1">
                        {te ? '30 ప్రశ్నలు' : '30 questions'}
                      </span>
                      <span className="text-brand-gold-muted text-xs bg-brand-bg border border-brand-border rounded-full px-3 py-1">
                        {te ? '1 గంట సమయం' : '1 hour'}
                      </span>
                      <span className="text-brand-gold-muted text-xs bg-brand-bg border border-brand-border rounded-full px-3 py-1">
                        {te ? 'ఉత్తీర్ణత: 70%' : '70% to pass'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => router.push(`/exams/${decl.category_key}`)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-bg font-semibold text-sm rounded-xl hover:bg-yellow-400 transition-colors whitespace-nowrap shrink-0"
                  >
                    {te ? 'పరీక్ష రాయండి' : 'Take Exam'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
