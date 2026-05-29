'use client'

import { useEffect, useState } from 'react'
import { Shield, ShieldOff, UserPlus } from 'lucide-react'

interface AdminUser {
  id: string
  full_name: string
  email: string
  avatar_initials: string
  created_at: string
}

export default function ManageAdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [demotingId, setDemotingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadAdmins() {
    const res = await fetch('/api/admin/admins')
    if (res.ok) setAdmins(await res.json())
    setLoading(false)
  }

  useEffect(() => { loadAdmins() }, [])

  async function handlePromote(e: React.FormEvent) {
    e.preventDefault()
    setPromoting(true)
    setMsg(null)
    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'error', text: data.error })
    } else {
      setMsg({ type: 'success', text: data.message })
      setEmail('')
      loadAdmins()
    }
    setPromoting(false)
  }

  async function handleDemote(userId: string) {
    if (!confirm('Remove admin privileges from this user?')) return
    setDemotingId(userId)
    setMsg(null)
    const res = await fetch(`/api/admin/admins/${userId}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'error', text: data.error })
    } else {
      setMsg({ type: 'success', text: 'Admin privileges removed.' })
      loadAdmins()
    }
    setDemotingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-brand-gold" />
        <h1 className="text-brand-gold font-bold text-xl">Manage Admins</h1>
      </div>

      {/* Promote form */}
      <div className="bg-brand-card border border-brand-border rounded-xl p-5">
        <h2 className="text-brand-body font-semibold text-sm mb-3">Promote User to Admin</h2>
        <p className="text-brand-gold-muted text-xs mb-4">
          The user must already have an account. Enter their registered email address.
        </p>

        {msg && (
          <div className={`mb-4 p-3 rounded-lg text-sm border ${
            msg.type === 'success'
              ? 'bg-brand-success/10 border-brand-success/30 text-brand-success'
              : 'bg-brand-error/10 border-brand-error/30 text-brand-error'
          }`}>
            {msg.text}
          </div>
        )}

        <form onSubmit={handlePromote} className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="user@example.com"
            className="flex-1 px-4 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
          />
          <button
            type="submit"
            disabled={promoting}
            className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-bg text-sm font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-70"
          >
            <UserPlus className="w-4 h-4" />
            {promoting ? 'Promoting…' : 'Promote'}
          </button>
        </form>
      </div>

      {/* Admins list */}
      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-brand-border">
          <h2 className="text-brand-gold font-semibold text-sm">Current Admins ({admins.length})</h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-brand-gold-muted text-sm">Loading…</div>
        ) : admins.length === 0 ? (
          <div className="p-6 text-center text-brand-gold-muted text-sm">No admins found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-brand-gold-muted text-xs uppercase border-b border-brand-border bg-brand-bg">
                <th className="text-left px-5 py-3 font-medium">Admin</th>
                <th className="text-left px-5 py-3 font-medium">Email</th>
                <th className="text-left px-5 py-3 font-medium">Since</th>
                <th className="text-right px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a, i) => (
                <tr key={a.id} className={`border-b border-brand-border last:border-0 ${i % 2 === 0 ? '' : 'bg-brand-bg/30'}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-brand-gold/20 border border-brand-gold/30 flex items-center justify-center text-brand-gold text-xs font-bold flex-shrink-0">
                        {a.avatar_initials}
                      </div>
                      <span className="text-brand-body">{a.full_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-brand-gold-muted">{a.email}</td>
                  <td className="px-5 py-3 text-brand-gold-muted text-xs">
                    {new Date(a.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDemote(a.id)}
                      disabled={demotingId === a.id}
                      title="Remove admin privileges"
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-brand-error border border-brand-error/30 rounded-lg hover:bg-brand-error/10 transition-colors disabled:opacity-50"
                    >
                      <ShieldOff className="w-3 h-3" />
                      {demotingId === a.id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
