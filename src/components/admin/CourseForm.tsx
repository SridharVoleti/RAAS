'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { getPaths } from '@/lib/getPaths'
import type { Course, CourseResource, LearningPath } from '@/types'

const CATEGORY_SUGGESTIONS = ['Grantha', 'Chanting', 'Philosophy', 'Rituals', 'Yoga', 'Puranas', 'Music', 'Language', 'Jyotisha', 'Vastu']
const LEVELS = ['Beginner', 'Intermediate', 'Advanced']

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface Props {
  course?: Course
}

export default function CourseForm({ course }: Props) {
  const router = useRouter()
  const isEdit = !!course

  const [form, setForm] = useState({
    path_id:        course?.path_id ?? 1,
    emoji:          course?.emoji ?? '📖',
    bg_color:       course?.bg_color ?? '#2d1a00',
    title_en:       course?.title_en ?? '',
    title_te:       course?.title_te ?? '',
    slug:           course?.slug ?? '',
    description_en: course?.description_en ?? '',
    description_te: course?.description_te ?? '',
    instructor_en:  course?.instructor_en ?? 'Rama Krishnamaa Charyulu Voleti',
    instructor_te:  course?.instructor_te ?? 'రామ కృష్ణమామా చార్యులుఓలేటి',
    category:       course?.category ?? 'Grantha',
    level:          course?.level ?? 'Beginner',
    duration:       course?.duration ?? '4 weeks',
    has_quiz:       course?.has_quiz ?? false,
    has_exam:       course?.has_exam ?? false,
    order_index:    course?.order_index ?? 0,
    is_free:        course?.is_free ?? false,
    price:          course?.price ?? 0,
    resources:      course?.resources ?? [] as CourseResource[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [paths, setPaths] = useState<LearningPath[]>([])

  // Path options come from the paths table (includes inactive paths so
  // courses can be staged for an unlaunched path)
  useEffect(() => {
    getPaths().then(setPaths).catch(() => {})
  }, [])

  function showError(msg: string) {
    setError(msg)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Auto-generate slug from English title when creating
  useEffect(() => {
    if (!isEdit && form.title_en) {
      setForm(f => ({ ...f, slug: toSlug(f.title_en) }))
    }
  }, [form.title_en, isEdit])

  function set(key: string, value: unknown) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function addResource() {
    setForm(f => ({ ...f, resources: [...f.resources, { title: '', url: '' }] }))
  }
  function updateResource(index: number, patch: Partial<CourseResource>) {
    setForm(f => ({
      ...f,
      resources: f.resources.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }))
  }
  function removeResource(index: number) {
    setForm(f => ({ ...f, resources: f.resources.filter((_, i) => i !== index) }))
  }

  async function handleSave(publish: boolean) {
    console.log('[CourseForm] handleSave called', { publish, isEdit, slug: form.slug })
    setError('')
    const hasTitle = form.title_en.trim() || form.title_te.trim()
    const hasDesc  = form.description_en.trim() || form.description_te.trim()
    if (!form.slug.trim() || !hasTitle || !hasDesc) {
      showError('Slug is required. At least one language title and one language description are required.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        is_published: publish,
        resources: form.resources.filter(r => r.title.trim() && r.url.trim()),
      }
      const url = isEdit ? `/api/admin/courses/${course!.id}` : '/api/admin/courses'
      const method = isEdit ? 'PUT' : 'POST'
      console.log('[CourseForm] Sending request', { method, url, payload })

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      console.log('[CourseForm] Response received', { status: res.status, ok: res.ok, data })

      if (!res.ok) {
        console.error('[CourseForm] Save failed', { status: res.status, error: data.error })
        showError(data.error || 'Save failed')
        return
      }

      const redirect = isEdit ? `/admin/courses/${data.id}` : '/admin/courses'
      console.log('[CourseForm] Save successful, redirecting to', redirect)
      router.push(redirect)
      router.refresh()
    } catch (err) {
      console.error('[CourseForm] Unexpected error during save', err)
      showError('An unexpected error occurred.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted/50 focus:outline-none focus:border-brand-gold transition-colors'
  const labelCls = 'block text-brand-body text-xs font-medium mb-1'
  const sectionCls = 'bg-brand-card border border-brand-border rounded-xl p-5 space-y-4'

  return (
    <div className="space-y-5 max-w-4xl">
      {error && (
        <div className="p-3 bg-brand-error/10 border border-brand-error/30 rounded-lg text-brand-error text-sm">
          {error}
        </div>
      )}

      {/* Identity */}
      <div className={sectionCls}>
        <h3 className="text-brand-gold text-sm font-semibold">Identity</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className={labelCls}>Emoji</label>
            <input value={form.emoji} onChange={e => set('emoji', e.target.value)}
              className={inputCls} placeholder="📖" />
          </div>
          <div>
            <label className={labelCls}>Background Colour</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.bg_color} onChange={e => set('bg_color', e.target.value)}
                className="w-10 h-9 rounded border border-brand-border bg-brand-bg cursor-pointer" />
              <input value={form.bg_color} onChange={e => set('bg_color', e.target.value)}
                className={`${inputCls} flex-1`} placeholder="#2d1a00" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Path</label>
            <select value={form.path_id} onChange={e => set('path_id', Number(e.target.value))}
              className={inputCls}>
              {paths.length === 0 && <option value={form.path_id}>Loading…</option>}
              {paths.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.is_active ? '' : ' (inactive)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Order Index</label>
            <input type="number" value={form.order_index} onChange={e => set('order_index', e.target.valueAsNumber || 0)}
              className={inputCls} min={0} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Slug (URL-safe, required — auto-generated from English title)</label>
          <input value={form.slug} onChange={e => set('slug', toSlug(e.target.value))}
            className={inputCls} placeholder="bhagavad-gita-essentials" />
        </div>
      </div>

      {/* Content */}
      <div className={sectionCls}>
        <h3 className="text-brand-gold text-sm font-semibold">Content <span className="text-brand-gold-muted font-normal text-xs">(at least one language required)</span></h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Title — English</label>
            <input value={form.title_en} onChange={e => set('title_en', e.target.value)}
              className={inputCls} placeholder="Bhagavad Gita Essentials" />
          </div>
          <div>
            <label className={labelCls}>Title — Telugu</label>
            <input value={form.title_te} onChange={e => set('title_te', e.target.value)}
              className={inputCls} placeholder="భగవద్గీత ముఖ్య అంశాలు" />
          </div>
          <div>
            <label className={labelCls}>Description — English</label>
            <textarea value={form.description_en} onChange={e => set('description_en', e.target.value)}
              rows={4} className={inputCls} placeholder="Course description in English…" />
          </div>
          <div>
            <label className={labelCls}>Description — Telugu</label>
            <textarea value={form.description_te} onChange={e => set('description_te', e.target.value)}
              rows={4} className={inputCls} placeholder="తెలుగులో వివరణ…" />
          </div>
          <div>
            <label className={labelCls}>Instructor — English</label>
            <input value={form.instructor_en} onChange={e => set('instructor_en', e.target.value)}
              className={inputCls} placeholder="Swami Ramananda" />
          </div>
          <div>
            <label className={labelCls}>Instructor — Telugu</label>
            <input value={form.instructor_te} onChange={e => set('instructor_te', e.target.value)}
              className={inputCls} placeholder="స్వామి రామానంద" />
          </div>
        </div>
      </div>

      {/* Classification */}
      <div className={sectionCls}>
        <h3 className="text-brand-gold text-sm font-semibold">Classification</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Category</label>
            <input
              list="category-suggestions"
              value={form.category}
              onChange={e => set('category', e.target.value)}
              className={inputCls}
              placeholder="e.g. Grantha"
            />
            <datalist id="category-suggestions">
              {CATEGORY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className={labelCls}>Level</label>
            <select value={form.level} onChange={e => set('level', e.target.value)} className={inputCls}>
              {LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Duration</label>
            <input value={form.duration} onChange={e => set('duration', e.target.value)}
              className={inputCls} placeholder="8 weeks" />
          </div>
        </div>
        <div className="flex items-center gap-6 pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.has_quiz} onChange={e => set('has_quiz', e.target.checked)}
              className="w-4 h-4 accent-yellow-400" />
            <span className="text-brand-body text-sm">Has Quiz</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.has_exam} onChange={e => set('has_exam', e.target.checked)}
              className="w-4 h-4 accent-yellow-400" />
            <span className="text-brand-body text-sm">Has Certification Exam</span>
          </label>
        </div>
      </div>

      {/* Pricing */}
      <div className={sectionCls}>
        <h3 className="text-brand-gold text-sm font-semibold">Pricing</h3>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.is_free} onChange={e => set('is_free', e.target.checked)}
            className="w-4 h-4 accent-yellow-400" />
          <span className="text-brand-body text-sm">Free course (no payment required)</span>
        </label>
        {!form.is_free && (
          <div className="max-w-xs">
            <label className={labelCls}>Price (₹)</label>
            <input type="number" value={form.price} onChange={e => set('price', e.target.valueAsNumber || 0)}
              min={0} step={1} className={inputCls} placeholder="799" />
          </div>
        )}
      </div>

      {/* Additional Resources */}
      <div className={sectionCls}>
        <h3 className="text-brand-gold text-sm font-semibold">Additional Resources</h3>
        <p className="text-brand-gold-muted text-xs -mt-2">Links to supplementary books or materials, shown to enrolled students on the watch page. The first link also becomes the course card&apos;s book-icon link.</p>
        {form.resources.length > 0 && (
          <div className="space-y-2">
            {form.resources.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                {i === 0 && (
                  <span
                    title="This link is used for the course card's book icon"
                    className="text-lg shrink-0"
                  >
                    📖
                  </span>
                )}
                <input
                  value={r.title}
                  onChange={e => updateResource(i, { title: e.target.value })}
                  placeholder="Resource title"
                  className={`${inputCls} flex-1`}
                />
                <input
                  value={r.url}
                  onChange={e => updateResource(i, { url: e.target.value })}
                  placeholder="https://…"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeResource(i)}
                  aria-label="Remove resource"
                  className="p-2 text-brand-gold-muted hover:text-brand-error transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addResource}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-border rounded-lg text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Resource
        </button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => handleSave(false)} disabled={saving}
          className="px-5 py-2.5 border border-brand-border rounded-lg text-brand-body text-sm font-medium hover:border-brand-gold transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : 'Save as Draft'}
        </button>
        <button onClick={() => handleSave(true)} disabled={saving}
          className="px-5 py-2.5 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50">
          {saving ? 'Saving…' : (isEdit ? 'Save & Publish' : 'Create & Publish')}
        </button>
        <button onClick={() => router.back()} disabled={saving}
          className="ml-auto px-4 py-2 text-brand-gold-muted text-sm hover:text-brand-gold transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}
