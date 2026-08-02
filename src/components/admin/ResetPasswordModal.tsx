'use client'

import { useState } from 'react'
import { Copy, Check, RefreshCw } from 'lucide-react'

interface Props {
  studentId: string
  studentName: string
  onClose: () => void
}

const SPECIALS = '!@#$%^&*'
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789' + SPECIALS

function generatePassword(): string {
  // Guarantee at least one of each required class, then fill the rest randomly.
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digit = '23456789'
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)]

  const required = [pick(upper), pick(lower), pick(digit), pick(SPECIALS)]
  const rest = Array.from({ length: 6 }, () => pick(CHARS))
  const all = [...required, ...rest]
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all.join('')
}

function passwordRequirements(pwd: string) {
  return {
    length: pwd.length >= 8,
    uppercase: /[A-Z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[^A-Za-z0-9]/.test(pwd),
  }
}

export default function ResetPasswordModal({ studentId, studentName, onClose }: Props) {
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const reqs = passwordRequirements(password)
  const isValid = reqs.length && reqs.uppercase && reqs.number && reqs.special

  async function handleSubmit() {
    if (!isValid) return
    setSaving(true)
    setError('')
    const res = await fetch(`/api/admin/students/${studentId}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setSaving(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'Reset failed')
      return
    }
    setDone(true)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        {done ? (
          <>
            <h3 className="text-brand-gold font-bold text-lg mb-2">Password Reset</h3>
            <p className="text-brand-body text-sm mb-4">
              {studentName}&rsquo;s password has been changed. Share this with them directly — it won&rsquo;t be shown again.
            </p>
            <div className="flex items-center gap-2 mb-6">
              <code className="flex-1 px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-gold text-sm font-mono break-all">
                {password}
              </code>
              <button onClick={handleCopy}
                className="p-2 border border-brand-border rounded-lg text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold transition-colors flex-shrink-0">
                {copied ? <Check className="w-4 h-4 text-brand-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button onClick={onClose}
              className="w-full py-2 bg-brand-gold text-brand-bg rounded-lg text-sm font-semibold hover:bg-yellow-400 transition-colors">
              Done
            </button>
          </>
        ) : (
          <>
            <h3 className="text-brand-gold font-bold text-lg mb-2">Reset Password</h3>
            <p className="text-brand-body text-sm mb-4">
              Set a new password for <span className="text-brand-gold">{studentName}</span>. They&rsquo;ll need it to log in — you&rsquo;re responsible for sharing it with them.
            </p>

            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                className="flex-1 px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm font-mono placeholder-brand-body/40 focus:outline-none focus:border-brand-gold"
              />
              <button onClick={() => setPassword(generatePassword())}
                title="Generate a random password"
                className="p-2 border border-brand-border rounded-lg text-brand-gold-muted hover:text-brand-gold hover:border-brand-gold transition-colors flex-shrink-0">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {password.length > 0 && (
              <ul className="mb-4 space-y-1">
                {[
                  { key: 'length', label: 'At least 8 characters', met: reqs.length },
                  { key: 'uppercase', label: 'At least 1 uppercase letter', met: reqs.uppercase },
                  { key: 'number', label: 'At least 1 number', met: reqs.number },
                  { key: 'special', label: 'At least 1 special character', met: reqs.special },
                ].map(r => (
                  <li key={r.key} className={`flex items-center gap-1.5 text-xs ${r.met ? 'text-brand-success' : 'text-brand-body/60'}`}>
                    <span>{r.met ? '✓' : '○'}</span>
                    {r.label}
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-brand-error/10 border border-brand-error/30 text-brand-error text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} disabled={saving}
                className="flex-1 py-2 border border-brand-border rounded-lg text-brand-body text-sm font-medium hover:border-brand-gold transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={!isValid || saving}
                className="flex-1 py-2 bg-brand-gold text-brand-bg rounded-lg text-sm font-semibold hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Saving…' : 'Reset Password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
