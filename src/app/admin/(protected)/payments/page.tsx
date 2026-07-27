'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Clock } from 'lucide-react'
import ConfirmModal from '@/components/admin/ConfirmModal'

interface Payment {
  id: number; amount: number; created_at: string; status: string
  student_name: string; course_title: string; user_id: string; course_id: number
}

interface CoursePurchase {
  id: number; amount_usd: number; created_at: string; status: string
  payment_reference: string | null
  student_name: string; student_email: string; course_title: string
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmTarget, setConfirmTarget] = useState<Payment | null>(null)
  const [confirming, setConfirming] = useState(false)

  const [purchases, setPurchases] = useState<CoursePurchase[]>([])
  const [purchasesLoading, setPurchasesLoading] = useState(true)
  const [confirmPurchaseTarget, setConfirmPurchaseTarget] = useState<CoursePurchase | null>(null)
  const [confirmingPurchase, setConfirmingPurchase] = useState(false)

  useEffect(() => { loadPayments(); loadPurchases() }, [])

  async function loadPayments() {
    setLoading(true)
    const res = await fetch('/api/admin/payments')
    setPayments(await res.json())
    setLoading(false)
  }

  async function loadPurchases() {
    setPurchasesLoading(true)
    const res = await fetch('/api/admin/course-purchases')
    setPurchases(await res.json())
    setPurchasesLoading(false)
  }

  async function handleConfirm() {
    if (!confirmTarget) return
    setConfirming(true)
    await fetch(`/api/admin/payments/${confirmTarget.id}/confirm`, { method: 'POST' })
    setConfirming(false)
    setConfirmTarget(null)
    setPayments(ps => ps.filter(p => p.id !== confirmTarget.id))
  }

  async function handleConfirmPurchase() {
    if (!confirmPurchaseTarget) return
    setConfirmingPurchase(true)
    await fetch(`/api/admin/course-purchases/${confirmPurchaseTarget.id}/confirm`, { method: 'POST' })
    setConfirmingPurchase(false)
    setConfirmPurchaseTarget(null)
    setPurchases(ps => ps.filter(p => p.id !== confirmPurchaseTarget.id))
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-brand-gold font-bold text-xl">Payments</h1>
        <p className="text-brand-gold-muted text-sm mt-1">
          Confirm UPI payments to activate student enrollments.
        </p>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-brand-gold-muted text-sm">Loading…</div>
        ) : payments.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-brand-success mx-auto mb-3 opacity-60" />
            <p className="text-brand-gold font-semibold text-lg">All caught up!</p>
            <p className="text-brand-gold-muted text-sm mt-1">No pending payments to confirm.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-brand-gold-muted text-xs uppercase font-medium border-b border-brand-border bg-brand-bg">
                  <th className="text-left px-5 py-3">Student</th>
                  <th className="text-left px-5 py-3">Course</th>
                  <th className="text-right px-5 py-3">Amount</th>
                  <th className="text-right px-5 py-3">Submitted</th>
                  <th className="text-right px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => (
                  <tr key={p.id}
                    className={`border-b border-brand-border last:border-0 ${i % 2 === 0 ? '' : 'bg-brand-bg/30'}`}>
                    <td className="px-5 py-3">
                      <div className="text-brand-body font-medium">{p.student_name}</div>
                    </td>
                    <td className="px-5 py-3 text-brand-body">{p.course_title}</td>
                    <td className="px-5 py-3 text-right font-semibold text-brand-gold">
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3 text-right text-brand-gold-muted text-xs">
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {new Date(p.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setConfirmTarget(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-success/10 text-brand-success border border-brand-success/30 text-xs font-semibold rounded-lg hover:bg-brand-success/20 transition-colors ml-auto">
                        <CheckCircle className="w-3.5 h-3.5" /> Confirm
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-brand-gold font-bold text-lg">International Course Purchases</h2>
        <p className="text-brand-gold-muted text-sm mt-1">
          Non-Indian students paying $25/course via bank transfer or QR — a sale, not a donation. Match the incoming
          transfer to the student below, then confirm to activate access and issue a receipt.
        </p>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-hidden">
        {purchasesLoading ? (
          <div className="py-16 text-center text-brand-gold-muted text-sm">Loading…</div>
        ) : purchases.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle className="w-12 h-12 text-brand-success mx-auto mb-3 opacity-60" />
            <p className="text-brand-gold font-semibold text-lg">All caught up!</p>
            <p className="text-brand-gold-muted text-sm mt-1">No pending international purchases to confirm.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-brand-gold-muted text-xs uppercase font-medium border-b border-brand-border bg-brand-bg">
                  <th className="text-left px-5 py-3">Student</th>
                  <th className="text-left px-5 py-3">Course</th>
                  <th className="text-left px-5 py-3">Reference</th>
                  <th className="text-right px-5 py-3">Amount</th>
                  <th className="text-right px-5 py-3">Submitted</th>
                  <th className="text-right px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p, i) => (
                  <tr key={p.id}
                    className={`border-b border-brand-border last:border-0 ${i % 2 === 0 ? '' : 'bg-brand-bg/30'}`}>
                    <td className="px-5 py-3">
                      <div className="text-brand-body font-medium">{p.student_name}</div>
                      <div className="text-brand-gold-muted text-xs">{p.student_email}</div>
                    </td>
                    <td className="px-5 py-3 text-brand-body">{p.course_title}</td>
                    <td className="px-5 py-3 text-brand-gold-muted text-xs font-mono">
                      {p.payment_reference ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-brand-gold">
                      ${Number(p.amount_usd).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right text-brand-gold-muted text-xs">
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3" />
                        {new Date(p.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setConfirmPurchaseTarget(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-success/10 text-brand-success border border-brand-success/30 text-xs font-semibold rounded-lg hover:bg-brand-success/20 transition-colors ml-auto">
                        <CheckCircle className="w-3.5 h-3.5" /> Confirm
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmTarget && (
        <ConfirmModal
          title="Confirm Payment"
          message={`Confirm ₹${Number(confirmTarget.amount).toLocaleString('en-IN')} payment from ${confirmTarget.student_name} for "${confirmTarget.course_title}"? This will activate their enrollment immediately.`}
          confirmLabel="Confirm & Enroll"
          loading={confirming}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmTarget(null)}
        />
      )}

      {confirmPurchaseTarget && (
        <ConfirmModal
          title="Confirm Purchase"
          message={`Confirm $${Number(confirmPurchaseTarget.amount_usd).toFixed(2)} purchase from ${confirmPurchaseTarget.student_name} for "${confirmPurchaseTarget.course_title}"? This will activate their enrollment and issue a receipt.`}
          confirmLabel="Confirm & Enroll"
          loading={confirmingPurchase}
          onConfirm={handleConfirmPurchase}
          onCancel={() => setConfirmPurchaseTarget(null)}
        />
      )}
    </div>
  )
}
