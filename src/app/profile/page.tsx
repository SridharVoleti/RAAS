'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { COUNTRIES, ISD_OPTIONS } from '@/lib/countries'

interface ProfileData {
  full_name: string
  email: string
  mobile: string
  isd_code: string
  city: string
  country: string
  avatar_initials: string
  preferred_lang: string
}

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Profile form state
  const [fullName, setFullName] = useState('')
  const [city, setCity] = useState('')
  const [country, setCountry] = useState('India')
  const [isd, setIsd] = useState('+91')
  const [mobile, setMobile] = useState('')

  // Password form state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?returnTo=/profile'); return }

      const res = await fetch('/api/profile')
      if (!res.ok) { router.push('/login?returnTo=/profile'); return }
      const data: ProfileData = await res.json()

      setProfile(data)
      setFullName(data.full_name || '')
      setCity(data.city || '')
      setCountry(data.country || 'India')
      setIsd(data.isd_code || '+91')
      setMobile(data.mobile || '')
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setProfileMsg(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, city, country, isd_code: isd, mobile }),
      })
      const data = await res.json()
      if (!res.ok) {
        setProfileMsg({ type: 'error', text: data.error || 'Failed to save' })
      } else {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' })
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    if (newPassword.length < 8) {
      setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' })
      return
    }
    setPwSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setPwMsg({ type: 'error', text: data.error || 'Failed to change password' })
      } else {
        setPwMsg({ type: 'success', text: 'Password changed successfully!' })
        setNewPassword('')
        setConfirmPassword('')
      }
    } finally {
      setPwSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-brand-gold text-5xl animate-pulse">ॐ</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-2xl font-bold">
            {profile?.avatar_initials}
          </div>
          <div>
            <h1 className="text-brand-gold font-bold text-2xl">{profile?.full_name}</h1>
            <p className="text-brand-gold-muted text-sm">
              {profile?.email || (profile?.mobile ? `${profile.isd_code}${profile.mobile}` : '')}
            </p>
          </div>
        </div>

        {/* Profile Info Section */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
          <h2 className="text-brand-gold font-semibold text-lg mb-5">Account Information</h2>

          {profileMsg && (
            <div className={`mb-4 p-3 rounded-lg text-sm border ${
              profileMsg.type === 'success'
                ? 'bg-brand-success/10 border-brand-success/30 text-brand-success'
                : 'bg-brand-error/10 border-brand-error/30 text-brand-error'
            }`}>
              {profileMsg.text}
            </div>
          )}

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                minLength={2}
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>

            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={profile?.email}
                disabled
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-gold-muted opacity-60 cursor-not-allowed"
              />
              <p className="text-brand-gold-muted text-xs mt-1">Email cannot be changed here.</p>
            </div>

            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">Mobile</label>
              <div className="flex gap-2">
                <select
                  value={isd}
                  onChange={e => setIsd(e.target.value)}
                  className="px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm focus:outline-none focus:border-brand-gold w-24"
                >
                  {ISD_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <input
                  type="tel"
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  placeholder="9876543210"
                  className="flex-1 px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="Your city"
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>

            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">Country</label>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body focus:outline-none focus:border-brand-gold transition-colors"
              >
                {COUNTRIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-70"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 mb-6">
          <h2 className="text-brand-gold font-semibold text-lg mb-5">Change Password</h2>

          {pwMsg && (
            <div className={`mb-4 p-3 rounded-lg text-sm border ${
              pwMsg.type === 'success'
                ? 'bg-brand-success/10 border-brand-success/30 text-brand-success'
                : 'bg-brand-error/10 border-brand-error/30 text-brand-error'
            }`}>
              {pwMsg.text}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                minLength={8}
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-brand-body text-sm font-medium mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className="w-full px-4 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={pwSaving}
              className="w-full py-2.5 bg-brand-bg border border-brand-gold text-brand-gold font-semibold rounded-lg hover:bg-brand-gold hover:text-brand-bg transition-colors disabled:opacity-70"
            >
              {pwSaving ? 'Updating…' : 'Change Password'}
            </button>
          </form>
        </div>

        <div className="text-center">
          <Link href="/my-courses" className="text-brand-gold-muted text-sm hover:text-brand-gold transition-colors">
            ← Back to My Courses
          </Link>
        </div>
      </div>
    </div>
  )
}
