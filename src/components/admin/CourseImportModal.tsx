'use client'

import { useRef, useState } from 'react'
import { Download, Upload, X, CheckCircle, AlertCircle, FileText } from 'lucide-react'

interface ImportResult {
  course: { id: number; slug: string; title_en: string }
  course_created: boolean
  lessons_created: number
  lessons_skipped: number
  warning?: string
}

interface Props {
  onClose: () => void
  onImported: () => void
}

export default function CourseImportModal({ onClose, onImported }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.csv')) { setError('Please select a .csv file'); return }
    setFile(f)
    setError('')
    setResult(null)
  }

  async function handleImport() {
    if (!file) { setError('Please select a CSV file first'); return }
    setUploading(true)
    setError('')

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/admin/courses/import', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok && res.status !== 207) {
        setError(data.error ?? 'Import failed')
        return
      }

      setResult(data)
      if (res.ok || res.status === 207) onImported()
    } catch {
      setError('Network error — please try again')
    } finally {
      setUploading(false)
    }
  }

  function handleDownloadTemplate() {
    window.location.href = '/api/admin/courses/import'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-brand-card border border-brand-border rounded-2xl w-full max-w-lg shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-brand-border">
          <div>
            <h2 className="text-brand-gold font-bold text-lg">Import Course from CSV</h2>
            <p className="text-brand-gold-muted text-xs mt-0.5">
              Upload a filled template to create a course with all its lessons.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-brand-gold-muted hover:text-brand-gold rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Step 1 — Download template */}
          <div className="bg-brand-bg/60 border border-brand-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-gold/20 text-brand-gold text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</div>
              <div className="flex-1 min-w-0">
                <p className="text-brand-body text-sm font-medium mb-1">Download the template</p>
                <p className="text-brand-gold-muted text-xs mb-3">
                  Fill in row 1 with your course details. Add one lesson per row from row 2 onward — leave course columns blank on those rows.
                </p>
                <p className="text-brand-gold-muted text-xs mb-3">
                  <span className="text-brand-gold font-medium">youtube_video_id</span> accepts a full YouTube URL or just the video ID (e.g. <span className="font-mono">dQw4w9WgXcQ</span>).
                </p>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-border/50 text-brand-body text-sm font-medium rounded-lg hover:bg-brand-border transition-colors border border-brand-border"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download course_import_template.csv
                </button>
              </div>
            </div>
          </div>

          {/* Step 2 — Upload */}
          <div className="bg-brand-bg/60 border border-brand-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-brand-gold/20 text-brand-gold text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</div>
              <div className="flex-1 min-w-0">
                <p className="text-brand-body text-sm font-medium mb-1">Upload your filled CSV</p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex items-center gap-2 p-2.5 bg-brand-gold/10 border border-brand-gold/30 rounded-lg">
                    <FileText className="w-4 h-4 text-brand-gold flex-shrink-0" />
                    <span className="text-brand-gold text-xs font-medium truncate">{file.name}</span>
                    <button
                      onClick={() => { setFile(null); setResult(null); setError('') }}
                      className="ml-auto text-brand-gold-muted hover:text-brand-gold flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex flex-col items-center gap-2 p-4 border-2 border-dashed border-brand-border rounded-lg text-brand-gold-muted hover:border-brand-gold hover:text-brand-gold transition-colors"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-xs">Click to select CSV file</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-brand-error/10 border border-brand-error/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-brand-error flex-shrink-0 mt-0.5" />
              <p className="text-brand-error text-xs">{error}</p>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className={`p-3 rounded-lg border ${result.warning ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-brand-success/10 border-brand-success/30'}`}>
              <div className="flex items-start gap-2">
                <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${result.warning ? 'text-yellow-400' : 'text-brand-success'}`} />
                <div className="space-y-0.5">
                  <p className={`text-sm font-medium ${result.warning ? 'text-yellow-300' : 'text-brand-success'}`}>
                    {result.course_created ? 'Course created!' : 'Lessons added to existing course'}
                  </p>
                  <p className="text-brand-body text-xs font-medium">{result.course.title_en}</p>
                  {result.lessons_created > 0 && (
                    <p className="text-brand-gold-muted text-xs">
                      {result.lessons_created} lesson{result.lessons_created !== 1 ? 's' : ''} added
                    </p>
                  )}
                  {result.lessons_skipped > 0 && (
                    <p className="text-brand-gold-muted text-xs">
                      {result.lessons_skipped} skipped — video already exists in this course
                    </p>
                  )}
                  {result.lessons_created === 0 && result.lessons_skipped > 0 && (
                    <p className="text-brand-gold-muted text-xs">All videos in the CSV already exist in this course.</p>
                  )}
                  {result.warning && (
                    <p className="text-yellow-400 text-xs mt-1">Warning: {result.warning}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-brand-gold-muted text-sm hover:text-brand-gold transition-colors"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || uploading}
              className="flex items-center gap-2 px-5 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Importing…' : 'Import Course'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
