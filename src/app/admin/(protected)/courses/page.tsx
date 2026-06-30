'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Eye, EyeOff, Upload } from 'lucide-react'
import ConfirmModal from '@/components/admin/ConfirmModal'
import CourseImportModal from '@/components/admin/CourseImportModal'

interface CourseRow {
  id: number; slug: string; emoji: string; title_en: string
  category: string; level: string; price: number; is_free: boolean
  is_published: boolean; lesson_count: number; student_count: number
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<CourseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<CourseRow | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => { loadCourses() }, [])

  async function loadCourses() {
    setLoading(true)
    const res = await fetch('/api/admin/courses')
    setCourses(await res.json())
    setLoading(false)
  }

  async function handleTogglePublish(course: CourseRow) {
    await fetch(`/api/admin/courses/${course.id}/publish`, { method: 'PATCH' })
    setCourses(cs => cs.map(c => c.id === course.id ? { ...c, is_published: !c.is_published } : c))
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    const res = await fetch(`/api/admin/courses/${deleteTarget.id}`, { method: 'DELETE' })
    const data = await res.json()
    setDeleting(false)
    if (!res.ok) { setDeleteError(data.error); return }
    setDeleteTarget(null)
    loadCourses()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-brand-gold font-bold text-xl">Courses</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-border/50 text-brand-body text-sm font-medium rounded-lg hover:bg-brand-border transition-colors border border-brand-border"
          >
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <Link href="/admin/courses/new"
            className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
            <Plus className="w-4 h-4" /> New Course
          </Link>
        </div>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-brand-gold-muted text-sm">Loading…</div>
        ) : courses.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-4xl mb-3">📚</div>
            <p className="text-brand-gold-muted text-sm mb-4">No courses yet.</p>
            <Link href="/admin/courses/new"
              className="px-5 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors">
              Create First Course
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-brand-gold-muted text-xs uppercase font-medium border-b border-brand-border bg-brand-bg">
                  <th className="text-left px-4 py-3">Course</th>
                  <th className="text-left px-4 py-3">Category</th>
                  <th className="text-left px-4 py-3">Level</th>
                  <th className="text-right px-4 py-3">Price</th>
                  <th className="text-right px-4 py-3">Lessons</th>
                  <th className="text-right px-4 py-3">Students</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course, i) => (
                  <tr key={course.id}
                    className={`border-b border-brand-border last:border-0 ${i % 2 === 0 ? '' : 'bg-brand-bg/30'} hover:bg-brand-bg/60 transition-colors`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{course.emoji}</span>
                        <div>
                          <div className="text-brand-body font-medium">{course.title_en}</div>
                          <div className="text-brand-gold-muted text-xs font-mono">{course.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-brand-body">{course.category}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        course.level === 'Beginner' ? 'text-brand-success border-brand-success bg-brand-success/10' :
                        course.level === 'Intermediate' ? 'text-brand-gold border-brand-gold bg-brand-gold/10' :
                        'text-brand-error border-brand-error bg-brand-error/10'
                      }`}>{course.level}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-brand-body">
                      {course.is_free ? <span className="text-brand-success text-xs font-semibold">Free</span> : `₹${course.price}`}
                    </td>
                    <td className="px-4 py-3 text-right text-brand-body">{course.lesson_count}</td>
                    <td className="px-4 py-3 text-right text-brand-body">{course.student_count}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleTogglePublish(course)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors mx-auto ${
                          course.is_published
                            ? 'bg-brand-success/10 text-brand-success border-brand-success hover:bg-brand-success/20'
                            : 'bg-brand-border/30 text-brand-gold-muted border-brand-border hover:border-brand-gold hover:text-brand-gold'
                        }`}>
                        {course.is_published ? <><Eye className="w-3 h-3" />Published</> : <><EyeOff className="w-3 h-3" />Draft</>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/admin/courses/${course.id}`}
                          className="p-1.5 text-brand-gold-muted hover:text-brand-gold transition-colors rounded">
                          <Pencil className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => { setDeleteTarget(course); setDeleteError('') }}
                          className="p-1.5 text-brand-gold-muted hover:text-brand-error transition-colors rounded">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showImport && (
        <CourseImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); loadCourses() }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete Course"
          message={deleteError || `Delete "${deleteTarget.title_en}"? This will also delete all lessons. Courses with enrollments cannot be deleted.`}
          confirmLabel="Delete"
          destructive
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setDeleteError('') }}
        />
      )}
    </div>
  )
}
