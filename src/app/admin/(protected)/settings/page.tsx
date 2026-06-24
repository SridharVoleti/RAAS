'use client'

import { useEffect, useState } from 'react'
import { Save, CheckCircle } from 'lucide-react'

type SiteSettings = {
  bank_upi_id:          string
  bank_account_holder:  string
  bank_name:            string
  bank_account_number:  string
  bank_ifsc:            string
  bank_qr_url:          string
  welcome_video_url:    string
}

const EMPTY: SiteSettings = {
  bank_upi_id:         '',
  bank_account_holder: '',
  bank_name:           '',
  bank_account_number: '',
  bank_ifsc:           '',
  bank_qr_url:         '',
  welcome_video_url:   '',
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SiteSettings>(EMPTY)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then((data: SiteSettings) => { setSettings({ ...EMPTY, ...data }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await fetch('/api/admin/settings', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(settings),
    })

    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } else {
      const body = await res.json() as { error?: string }
      setError(body.error ?? 'Save failed')
    }
    setSaving(false)
  }

  function field(label: string, key: keyof SiteSettings, placeholder: string, hint?: string) {
    return (
      <div>
        <label className="block text-brand-body text-sm font-medium mb-1">{label}</label>
        {hint && <p className="text-brand-gold-muted text-xs mb-1.5">{hint}</p>}
        <input
          type="text"
          value={settings[key]}
          onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted focus:outline-none focus:border-brand-gold transition-colors"
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-brand-gold text-3xl animate-pulse">ॐ</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-brand-gold font-bold text-xl">Site Settings</h1>
        <p className="text-brand-gold-muted text-sm mt-1">
          Bank & UPI details shown to donors on payment and donation pages.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-brand-card border border-brand-border rounded-xl p-6 space-y-5">
        <h2 className="text-brand-gold font-semibold text-base border-b border-brand-border pb-3">
          Bank / UPI Details
        </h2>

        {field('UPI ID', 'bank_upi_id', 'e.g. krishnamargam@upi',
          'Displayed prominently — donors copy this to pay via any UPI app.')}

        {field('Account Holder Name', 'bank_account_holder', 'e.g. Krishnamargam Trust')}

        {field('Bank Name', 'bank_name', 'e.g. State Bank of India')}

        {field('Account Number', 'bank_account_number', 'e.g. 123456789012')}

        {field('IFSC Code', 'bank_ifsc', 'e.g. SBIN0001234')}

        {field('UPI QR Code Image URL', 'bank_qr_url', 'https://…/qr.png',
          'Optional. If set, a QR code image is shown on the donation page.')}

        <h2 className="text-brand-gold font-semibold text-base border-b border-brand-border pb-3 pt-2">
          Welcome Video
        </h2>

        {field('Welcome Video URL', 'welcome_video_url', 'https://www.youtube.com/watch?v=…',
          'YouTube or direct video URL shown in a dialog when users visit the home page. Leave blank to disable the dialog.')}

        {settings.welcome_video_url && (
          <p className="text-brand-gold-muted text-xs -mt-2">
            Dialog will show on every visit. First-time visitors see a &ldquo;Must Watch&rdquo; badge; returning visitors get a Skip option.
          </p>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-bg rounded-lg font-semibold text-sm hover:bg-yellow-400 transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>

          {saved && (
            <span className="flex items-center gap-1.5 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              Saved successfully
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
