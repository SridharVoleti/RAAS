'use client'

import { useEffect, useState } from 'react'
import { Users, Save, Check } from 'lucide-react'
import { COUNTRIES, ISD_OPTIONS } from '@/lib/countries'

interface Student {
  id: string
  full_name: string
  email: string
  avatar_initials: string
  created_at: string
  enrolled_courses: number
  student_id: number | null
  username: string | null
  fathers_name: string | null
  address: string | null
  referral_source: string | null
  mobile: string | null
  isd_code: string
  city: string | null
  country: string
  preferred_lang: 'en' | 'te'
}

type EditableField =
  | 'full_name' | 'isd_code' | 'mobile' | 'city' | 'country' | 'student_id'
  | 'username' | 'fathers_name' | 'address' | 'referral_source' | 'preferred_lang'

const EDITABLE_FIELDS: EditableField[] = [
  'full_name', 'isd_code', 'mobile', 'city', 'country', 'student_id',
  'username', 'fathers_name', 'address', 'referral_source', 'preferred_lang',
]

const inputClass = 'w-full px-2 py-1.5 bg-brand-bg border border-brand-border rounded-md text-brand-body text-xs placeholder:text-brand-gold-muted/50 focus:outline-none focus:border-brand-gold transition-colors'

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [originals, setOriginals] = useState<Record<string, Student>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/students')
      .then(r => r.json())
      .then(d => {
        const items: Student[] = d.items ?? []
        setStudents(items)
        setOriginals(Object.fromEntries(items.map(s => [s.id, s])))
        setLoading(false)
      })
  }, [])

  const filtered = students.filter(s =>
    s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  function updateField(id: string, field: EditableField, value: string) {
    setStudents(prev => prev.map(s => {
      if (s.id !== id) return s
      if (field === 'student_id') {
        return { ...s, student_id: value.trim() === '' ? null : Number(value) }
      }
      return { ...s, [field]: value }
    }))
  }

  function isDirty(s: Student): boolean {
    const original = originals[s.id]
    if (!original) return false
    return EDITABLE_FIELDS.some(f => (original[f] ?? '') !== (s[f] ?? ''))
  }

  async function handleSave(s: Student) {
    setSavingId(s.id)
    setErrors(prev => {
      const next = { ...prev }
      delete next[s.id]
      return next
    })

    const payload = Object.fromEntries(EDITABLE_FIELDS.map(f => [f, s[f]]))
    const res = await fetch(`/api/admin/students/${s.id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    setSavingId(null)

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setErrors(prev => ({ ...prev, [s.id]: body.error ?? 'Save failed' }))
      return
    }
    setOriginals(prev => ({ ...prev, [s.id]: s }))
    setSavedId(s.id)
    setTimeout(() => setSavedId(cur => cur === s.id ? null : cur), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-brand-gold font-bold text-xl">Students</h1>
          <p className="text-brand-gold-muted text-sm mt-1">
            {students.length} registered student{students.length !== 1 ? 's' : ''} — edit any field and hit Save.
          </p>
        </div>
        <input
          type="search" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-64 px-3 py-2 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm placeholder:text-brand-gold-muted/50 focus:outline-none focus:border-brand-gold transition-colors"
        />
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-brand-gold-muted text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 text-brand-gold-muted mx-auto mb-3 opacity-40" />
            <p className="text-brand-gold-muted text-sm">{search ? 'No students match your search.' : 'No students yet.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1900px]">
              <thead>
                <tr className="text-brand-gold-muted text-xs uppercase font-medium border-b border-brand-border bg-brand-bg">
                  <th className="text-left px-4 py-3 w-48">Name</th>
                  <th className="text-left px-4 py-3 w-48">Email</th>
                  <th className="text-left px-4 py-3 w-48">Mobile</th>
                  <th className="text-left px-4 py-3 w-32">City</th>
                  <th className="text-left px-4 py-3 w-40">Country</th>
                  <th className="text-left px-4 py-3 w-28">Student ID</th>
                  <th className="text-left px-4 py-3 w-32">Username</th>
                  <th className="text-left px-4 py-3 w-36">Father&rsquo;s Name</th>
                  <th className="text-left px-4 py-3 w-48">Address</th>
                  <th className="text-left px-4 py-3 w-36">Referral Source</th>
                  <th className="text-left px-4 py-3 w-24">Language</th>
                  <th className="text-right px-4 py-3 w-24">Enrolled</th>
                  <th className="text-right px-4 py-3 w-24">Joined</th>
                  <th className="text-right px-4 py-3 w-28">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-brand-border last:border-0 align-top ${i % 2 === 0 ? '' : 'bg-brand-bg/30'}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center text-brand-bg text-[10px] font-bold flex-shrink-0">
                          {s.avatar_initials}
                        </div>
                        <input
                          value={s.full_name}
                          onChange={e => updateField(s.id, 'full_name', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-brand-gold-muted text-xs pt-4">{s.email || '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <select
                          value={s.isd_code}
                          onChange={e => updateField(s.id, 'isd_code', e.target.value)}
                          className={`${inputClass} w-16 flex-shrink-0`}
                        >
                          {ISD_OPTIONS.map(code => <option key={code} value={code}>{code}</option>)}
                        </select>
                        <input
                          value={s.mobile ?? ''}
                          onChange={e => updateField(s.id, 'mobile', e.target.value)}
                          className={`${inputClass} flex-1 min-w-[100px]`}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        value={s.city ?? ''}
                        onChange={e => updateField(s.id, 'city', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={s.country}
                        onChange={e => updateField(s.id, 'country', e.target.value)}
                        className={inputClass}
                      >
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={s.student_id ?? ''}
                        onChange={e => updateField(s.id, 'student_id', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        value={s.username ?? ''}
                        onChange={e => updateField(s.id, 'username', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        value={s.fathers_name ?? ''}
                        onChange={e => updateField(s.id, 'fathers_name', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        value={s.address ?? ''}
                        onChange={e => updateField(s.id, 'address', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        value={s.referral_source ?? ''}
                        onChange={e => updateField(s.id, 'referral_source', e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <select
                        value={s.preferred_lang}
                        onChange={e => updateField(s.id, 'preferred_lang', e.target.value)}
                        className={inputClass}
                      >
                        <option value="en">English</option>
                        <option value="te">Telugu</option>
                      </select>
                    </td>
                    <td className="px-4 py-2.5 text-right pt-4">
                      <span className="px-2 py-0.5 bg-brand-gold/10 text-brand-gold text-xs rounded-full font-medium whitespace-nowrap">
                        {s.enrolled_courses}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-brand-gold-muted text-xs pt-4 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5 text-right pt-3">
                      <button
                        onClick={() => handleSave(s)}
                        disabled={!isDirty(s) || savingId === s.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-success/10 text-brand-success border border-brand-success/30 text-xs font-semibold rounded-lg hover:bg-brand-success/20 transition-colors ml-auto disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {savedId === s.id
                          ? <Check className="w-3.5 h-3.5" />
                          : <Save className="w-3.5 h-3.5" />}
                        {savingId === s.id ? 'Saving…' : savedId === s.id ? 'Saved' : 'Save'}
                      </button>
                      {errors[s.id] && (
                        <p className="text-brand-error text-[11px] mt-1 max-w-[110px] ml-auto text-right">{errors[s.id]}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
