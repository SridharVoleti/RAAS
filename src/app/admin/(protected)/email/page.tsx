'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Info, Send } from 'lucide-react'

const VARIABLES = [
  { token: '{{name}}',      desc: "Student's full name" },
  { token: '{{course_en}}', desc: 'Course title (English)' },
  { token: '{{course_te}}', desc: 'Course title (Telugu)' },
  { token: '{{link}}',      desc: 'Link to My Courses page' },
]

export default function AdminEmailPage() {
  const [subject, setSubject] = useState('')
  const [body, setBody]       = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  const [testTo, setTestTo]         = useState('')
  const [testSending, setTestSending] = useState(false)
  const [testResult, setTestResult]   = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/email-templates/enrollment')
      .then(r => r.json())
      .then(d => {
        setSubject(d.subject ?? '')
        setBody(d.body ?? '')
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    const res = await fetch('/api/admin/email-templates/enrollment', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Save failed')
    }
  }

  function insertToken(token: string) {
    setBody(prev => prev + token)
  }

  async function handleTestSend() {
    setTestSending(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/email/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testTo.trim() ? { to: testTo.trim() } : {}),
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult({ ok: true, message: `Sent to ${data.to}${data.emailId ? ` (id: ${data.emailId})` : ''}` })
      } else {
        setTestResult({ ok: false, message: data.error ?? 'Send failed' })
      }
    } catch {
      setTestResult({ ok: false, message: 'Request failed' })
    } finally {
      setTestSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-brand-gold font-bold text-xl">Email Templates</h1>
        <p className="text-brand-gold-muted text-sm mt-1">
          Customize the enrollment confirmation email sent to students.
        </p>
      </div>

      {/* Resend test send */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-brand-gold text-sm font-semibold">
          <Send className="w-4 h-4" />
          Send Test Email
        </div>
        <p className="text-brand-gold-muted text-xs">
          Sends a one-off test email via Resend to confirm the integration is working. Defaults to your admin email.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="email"
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
            placeholder="you@example.com (optional)"
            className="flex-1 bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-brand-body text-sm focus:outline-none focus:border-brand-gold placeholder-brand-gold-muted/50"
          />
          <button
            onClick={handleTestSend}
            disabled={testSending}
            className="px-4 py-2 bg-brand-gold text-brand-bg rounded-lg text-sm font-semibold hover:bg-brand-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {testSending ? 'Sending…' : 'Send Test'}
          </button>
        </div>
        {testResult && (
          <p className={`text-sm ${testResult.ok ? 'text-brand-success' : 'text-brand-error'}`}>
            {testResult.message}
          </p>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-brand-gold-muted text-sm">Loading…</div>
      ) : (
        <div className="space-y-5">

          {/* Variable reference */}
          <div className="bg-brand-card border border-brand-border rounded-xl p-4">
            <div className="flex items-center gap-2 text-brand-gold text-sm font-semibold mb-3">
              <Info className="w-4 h-4" />
              Available Variables
            </div>
            <div className="grid grid-cols-2 gap-2">
              {VARIABLES.map(v => (
                <button
                  key={v.token}
                  onClick={() => insertToken(v.token)}
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-brand-bg border border-brand-border hover:border-brand-gold/50 transition-colors text-left group"
                >
                  <code className="text-brand-gold text-xs font-mono bg-brand-border/60 px-1.5 py-0.5 rounded shrink-0 group-hover:bg-brand-gold/10">
                    {v.token}
                  </code>
                  <span className="text-brand-gold-muted text-xs leading-tight">{v.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-brand-gold-muted text-xs mt-3">
              Click a variable to insert it at the end of the message body.
            </p>
          </div>

          {/* Subject */}
          <div className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-2">
            <label className="block text-brand-gold text-sm font-semibold">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-brand-body text-sm focus:outline-none focus:border-brand-gold placeholder-brand-gold-muted/50"
              placeholder="e.g. You're enrolled in {{course_en}} — Krishnamargam"
            />
          </div>

          {/* Body */}
          <div className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-2">
            <label className="block text-brand-gold text-sm font-semibold">
              Message Body
            </label>
            <p className="text-brand-gold-muted text-xs">
              Plain text. Use the variables above to personalize. Line breaks are preserved.
            </p>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={10}
              className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2.5 text-brand-body text-sm focus:outline-none focus:border-brand-gold resize-y font-mono leading-relaxed"
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={saving || !subject.trim() || !body.trim()}
              className="px-6 py-2.5 bg-brand-gold text-brand-bg rounded-lg text-sm font-semibold hover:bg-brand-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save Template'}
            </button>
            {saved && (
              <div className="flex items-center gap-1.5 text-brand-success text-sm">
                <CheckCircle className="w-4 h-4" />
                Saved
              </div>
            )}
            {error && <p className="text-brand-error text-sm">{error}</p>}
          </div>

        </div>
      )}
    </div>
  )
}
