'use client'

import { useRef, useState, useEffect } from 'react'
import {
  Bold, Italic, Underline, List, ListOrdered,
  Link, Unlink, Send, Eye, EyeOff, Users, AlertCircle,
  CheckCircle, XCircle,
} from 'lucide-react'

// ── Toolbar button ─────────────────────────────────────────────────────────────

function ToolBtn({
  onClick, title, children,
}: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className="flex items-center justify-center w-8 h-8 rounded text-sm font-medium text-brand-gold-muted hover:text-brand-gold hover:bg-brand-border/50 transition-colors"
    >
      {children}
    </button>
  )
}

// ── Brand colours for the email preview panel ──────────────────────────────────

const PREV = {
  bg:      '#1a0f00', card:    '#120a00', header:  '#0d0800',
  border:  '#3a2800', body:    '#f5e6c8', muted:   '#a07030',
  gold:    '#f0b429',
}

// ── Progress state ─────────────────────────────────────────────────────────────

interface Progress {
  batchIndex:       number   // 0-based batch just completed
  totalBatches:     number
  totalRecipients:  number
  sent:             number   // cumulative recipients delivered so far
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NewsletterPage() {
  const editorRef      = useRef<HTMLDivElement>(null)
  const cancelRef      = useRef(false)          // stops the loop between batches

  const [subject,        setSubject]        = useState('')
  const [isEmpty,        setIsEmpty]        = useState(true)
  const [showPreview,    setShowPreview]    = useState(false)
  const [previewHtml,    setPreviewHtml]    = useState('')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [showConfirm,    setShowConfirm]    = useState(false)
  const [sending,        setSending]        = useState(false)
  const [progress,       setProgress]       = useState<Progress | null>(null)
  const [done,           setDone]           = useState<{ sent: number; batches: number } | null>(null)
  const [error,          setError]          = useState<string | null>(null)

  // Load recipient count on mount
  useEffect(() => {
    fetch('/api/admin/newsletter')
      .then(r => r.json())
      .then(d => {
        setRecipientCount(d.recipientCount ?? 0)
        if (d.fetchError) setRecipientError(d.fetchError)
      })
      .catch(() => setRecipientError('Could not reach the server. Check your connection.'))
  }, [])

  // ── Editor helpers ───────────────────────────────────────────────────────────

  function execCmd(command: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, value ?? undefined)
    syncEmpty()
  }

  function syncEmpty() {
    const html = editorRef.current?.innerHTML ?? ''
    setIsEmpty(!html.trim() || html === '<br>' || html === '<div><br></div>')
  }

  function insertLink() {
    const url = prompt('Enter the URL (include https://):', 'https://')
    if (!url?.trim()) return
    execCmd('createLink', url.trim())
    editorRef.current?.querySelectorAll('a:not([target])').forEach(a => {
      a.setAttribute('target', '_blank')
      a.setAttribute('rel', 'noopener noreferrer')
    })
  }

  function togglePreview() {
    if (!showPreview) setPreviewHtml(editorRef.current?.innerHTML ?? '')
    setShowPreview(v => !v)
  }

  // ── Send loop ────────────────────────────────────────────────────────────────

  async function runSendLoop() {
    setShowConfirm(false)
    setSending(true)
    setProgress(null)
    setDone(null)
    setError(null)
    cancelRef.current = false

    const htmlBody    = editorRef.current?.innerHTML ?? ''
    let   batchIndex  = 0
    let   totalSent   = 0

    try {
      while (!cancelRef.current) {
        const res  = await fetch('/api/admin/newsletter', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ subject, htmlBody, batchIndex }),
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error ?? `Batch ${batchIndex + 1} failed. Please retry.`)
          break
        }

        totalSent += data.sent as number
        setProgress({
          batchIndex:      data.batchIndex as number,
          totalBatches:    data.totalBatches as number,
          totalRecipients: data.totalRecipients as number,
          sent:            totalSent,
        })

        if (!data.hasMore) {
          setDone({ sent: totalSent, batches: (data.batchIndex as number) + 1 })
          break
        }

        batchIndex++
      }

      if (cancelRef.current) {
        setError(`Cancelled after batch ${batchIndex}. Sent to ${totalSent} member${totalSent !== 1 ? 's' : ''}.`)
      }
    } catch {
      setError('Network error — please check your connection and retry.')
    } finally {
      setSending(false)
    }
  }

  const canSend = subject.trim().length > 0 && !isEmpty

  // Derived progress values for the bar
  const pct = progress
    ? Math.round((progress.sent / progress.totalRecipients) * 100)
    : 0

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-brand-gold font-bold text-xl">Newsletter</h1>
        <p className="text-brand-gold-muted text-sm mt-1">
          Compose and send a message to all registered members. Users are delivered in BCC batches of 50.
        </p>
      </div>

      {/* Recipient count / error */}
      {recipientError ? (
        <div className="flex items-start gap-2 p-3 bg-brand-error/10 border border-brand-error/30 rounded-xl">
          <AlertCircle className="w-4 h-4 text-brand-error flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-brand-error text-sm font-medium">Could not load recipient list</p>
            <p className="text-brand-error/70 text-xs mt-0.5 font-mono">{recipientError}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-gold-muted flex-shrink-0" />
          <span className="text-brand-gold-muted text-sm">
            {recipientCount === null
              ? 'Loading recipients…'
              : `${recipientCount} registered member${recipientCount !== 1 ? 's' : ''} will receive this`}
          </span>
        </div>
      )}

      {/* ── Live progress ── */}
      {sending && progress && (
        <div className="bg-brand-card border border-brand-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-brand-gold text-sm font-semibold">
              Sending batch {progress.batchIndex + 1} of {progress.totalBatches}…
            </span>
            <button
              onClick={() => { cancelRef.current = true }}
              className="flex items-center gap-1 text-brand-error text-xs hover:underline"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-brand-bg rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-brand-gold h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-brand-gold-muted">
            <span>{progress.sent} of {progress.totalRecipients} members reached</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}

      {/* ── Done banner ── */}
      {done && !sending && (
        <div className="flex items-start gap-3 p-4 bg-brand-success/10 border border-brand-success/30 rounded-xl text-brand-success">
          <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Newsletter sent successfully!</p>
            <p className="text-xs mt-0.5 text-brand-success/80">
              {done.sent} member{done.sent !== 1 ? 's' : ''} reached across {done.batches} batch{done.batches !== 1 ? 'es' : ''}.
            </p>
          </div>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && !sending && (
        <div className="flex items-start gap-3 p-4 bg-brand-error/10 border border-brand-error/30 rounded-xl text-brand-error">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* ── Subject ── */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-5">
        <label className="block text-brand-gold text-sm font-semibold mb-2">Subject Line</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          disabled={sending}
          placeholder="e.g. New course available — Krishnamargam"
          className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm focus:outline-none focus:border-brand-gold placeholder-brand-gold-muted/50 disabled:opacity-50"
        />
      </div>

      {/* ── Editor card ── */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center flex-wrap gap-0.5 px-3 py-2 border-b border-brand-border bg-brand-bg">
          <ToolBtn title="Bold (Ctrl+B)"       onClick={() => execCmd('bold')}>
            <Bold className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Italic (Ctrl+I)"     onClick={() => execCmd('italic')}>
            <Italic className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Underline (Ctrl+U)"  onClick={() => execCmd('underline')}>
            <Underline className="w-4 h-4" />
          </ToolBtn>

          <div className="w-px h-5 bg-brand-border mx-1" />

          <ToolBtn title="Heading 1"  onClick={() => execCmd('formatBlock', 'h1')}>
            <span className="text-xs font-bold">H1</span>
          </ToolBtn>
          <ToolBtn title="Heading 2"  onClick={() => execCmd('formatBlock', 'h2')}>
            <span className="text-xs font-bold">H2</span>
          </ToolBtn>
          <ToolBtn title="Paragraph"  onClick={() => execCmd('formatBlock', 'p')}>
            <span className="text-xs">P</span>
          </ToolBtn>

          <div className="w-px h-5 bg-brand-border mx-1" />

          <ToolBtn title="Bullet list"    onClick={() => execCmd('insertUnorderedList')}>
            <List className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Numbered list"  onClick={() => execCmd('insertOrderedList')}>
            <ListOrdered className="w-4 h-4" />
          </ToolBtn>

          <div className="w-px h-5 bg-brand-border mx-1" />

          <ToolBtn title="Insert link"  onClick={insertLink}>
            <Link className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn title="Remove link"  onClick={() => execCmd('unlink')}>
            <Unlink className="w-4 h-4" />
          </ToolBtn>

          <div className="flex-1" />

          <button
            type="button"
            onClick={togglePreview}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-brand-gold-muted hover:text-brand-gold border border-brand-border rounded-lg hover:border-brand-gold transition-colors"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? 'Back to edit' : 'Preview email'}
          </button>
        </div>

        {/* Editor / Preview */}
        {showPreview ? (
          <div className="p-4 overflow-auto" style={{ background: PREV.bg }}>
            <div style={{
              maxWidth: 600, margin: '0 auto', background: PREV.card,
              borderRadius: 12, border: `1px solid ${PREV.border}`, overflow: 'hidden',
            }}>
              <div style={{ background: PREV.header, padding: '20px 24px', textAlign: 'center', borderBottom: `1px solid ${PREV.border}` }}>
                <div style={{ color: PREV.gold, fontSize: 32 }}>ॐ</div>
                <div style={{ color: PREV.gold, fontSize: 18, fontWeight: 700, marginTop: 8 }}>కృష్ణమార్గం</div>
                <div style={{ color: PREV.muted, fontSize: 12, marginTop: 2 }}>Krishnamargam</div>
              </div>
              <div style={{ padding: '28px 36px' }}>
                {subject && (
                  <h1 style={{ color: PREV.gold, fontSize: 20, fontWeight: 700, margin: '0 0 20px 0' }}>{subject}</h1>
                )}
                <div
                  style={{ color: PREV.body, fontSize: 15, lineHeight: 1.7 }}
                  dangerouslySetInnerHTML={{ __html: previewHtml || `<p style="color:${PREV.muted}">Your message will appear here…</p>` }}
                />
              </div>
              <div style={{ padding: '16px 36px', borderTop: `1px solid ${PREV.border}`, textAlign: 'center' }}>
                <p style={{ color: PREV.muted, fontSize: 11, margin: 0, lineHeight: 1.8 }}>
                  BabyStepsIndia.in · Krishnamargam<br />Vedic wisdom for the modern seeker
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div
              ref={editorRef}
              contentEditable={!sending}
              suppressContentEditableWarning
              onInput={syncEmpty}
              className="min-h-[360px] px-5 py-4 text-brand-body text-sm leading-relaxed focus:outline-none
                [&_h1]:text-brand-gold [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:mt-1
                [&_h2]:text-brand-gold [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mb-2 [&_h2]:mt-1
                [&_p]:mb-3 [&_p]:leading-relaxed
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3
                [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3
                [&_li]:mb-1 [&_a]:text-brand-gold [&_a]:underline
                [&_strong]:font-bold [&_em]:italic [&_u]:underline"
            />
            {isEmpty && (
              <p className="absolute top-4 left-5 text-brand-gold-muted/50 text-sm pointer-events-none select-none">
                Start typing your newsletter here…
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Send button ── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={!canSend || sending}
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-4 h-4" />
          {sending ? 'Sending…' : 'Send Newsletter'}
        </button>

        {!canSend && !sending && (
          <p className="text-brand-gold-muted text-sm">
            {!subject.trim() ? 'Add a subject line first.' : 'Write a message body first.'}
          </p>
        )}
      </div>

      {/* ── Confirm modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-brand-card border border-brand-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Send className="w-5 h-5 text-brand-gold" />
              <h2 className="text-brand-gold font-bold text-base">Confirm Send</h2>
            </div>

            <p className="text-brand-body text-sm mb-1">You&rsquo;re about to send:</p>
            <p className="text-brand-gold font-semibold text-sm mb-3 truncate">&ldquo;{subject}&rdquo;</p>

            <div className="bg-brand-bg border border-brand-border rounded-lg px-4 py-3 mb-4 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-brand-gold-muted">Recipients</span>
                <span className="text-brand-body font-medium">{recipientCount ?? '?'} members</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-brand-gold-muted">Batches of 50</span>
                <span className="text-brand-body font-medium">
                  {recipientCount != null ? Math.ceil(recipientCount / 50) : '?'} batch{recipientCount != null && Math.ceil(recipientCount / 50) !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-brand-gold-muted">Delivery</span>
                <span className="text-brand-body font-medium">BCC (recipients hidden from each other)</span>
              </div>
            </div>

            <p className="text-brand-gold-muted text-xs mb-5">This cannot be undone. You can cancel mid-send to stop remaining batches.</p>

            <div className="flex gap-3">
              <button
                onClick={runSendLoop}
                className="flex-1 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
              >
                Yes, Send Now
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 border border-brand-border text-brand-gold-muted text-sm rounded-lg hover:border-brand-gold hover:text-brand-gold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
