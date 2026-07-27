'use client'

import { useEffect, useState } from 'react'

interface Donation {
  id:                  string
  amount:              number
  purpose:             string
  status:              string
  receipt_number:      string | null
  razorpay_payment_id: string | null
  created_at:          string
  donor_name:          string
  donor_email:         string
  donor_state:         string | null
  declaration_accepted: boolean
  course_title:        string | null
}

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch('/api/admin/donations')
      .then(r => r.json())
      .then((data: Donation[]) => { setDonations(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const total = donations
    .filter(d => d.status === 'paid')
    .reduce((sum, d) => sum + d.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-brand-gold text-3xl animate-pulse">ॐ</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-brand-gold font-bold text-xl">Donations</h1>
          <p className="text-brand-gold-muted text-sm mt-1">
            Total received: <span className="text-brand-gold font-semibold">₹{(total / 100).toLocaleString('en-IN')}</span>
          </p>
        </div>
      </div>

      {donations.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-xl p-8 text-center">
          <p className="text-brand-gold text-2xl mb-2">🙏</p>
          <p className="text-brand-body font-medium">No donations yet.</p>
        </div>
      ) : (
        <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border">
                <th className="text-left text-brand-gold-muted font-medium px-4 py-3">Donor</th>
                <th className="text-left text-brand-gold-muted font-medium px-4 py-3">Amount</th>
                <th className="text-left text-brand-gold-muted font-medium px-4 py-3">State</th>
                <th className="text-left text-brand-gold-muted font-medium px-4 py-3">Declared</th>
                <th className="text-left text-brand-gold-muted font-medium px-4 py-3">Purpose</th>
                <th className="text-left text-brand-gold-muted font-medium px-4 py-3">Receipt</th>
                <th className="text-left text-brand-gold-muted font-medium px-4 py-3">Status</th>
                <th className="text-left text-brand-gold-muted font-medium px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {donations.map(d => (
                <tr key={d.id} className="hover:bg-brand-border/10 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-brand-body font-medium">{d.donor_name || '—'}</div>
                    <div className="text-brand-gold-muted text-xs">{d.donor_email || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-brand-gold font-semibold">
                    ₹{(d.amount / 100).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-brand-gold-muted">
                    {d.donor_state ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    {d.declaration_accepted
                      ? <span className="text-green-400">Yes</span>
                      : <span className="text-brand-gold-muted">—</span>}
                  </td>
                  <td className="px-4 py-3 text-brand-body">
                    {d.purpose === 'course' && d.course_title ? d.course_title : 'General'}
                  </td>
                  <td className="px-4 py-3 text-brand-gold-muted font-mono text-xs">
                    {d.receipt_number ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      d.status === 'paid'
                        ? 'bg-green-500/10 text-green-400'
                        : d.status === 'failed'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-brand-gold/10 text-brand-gold'
                    }`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-brand-gold-muted text-xs">
                    {new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
