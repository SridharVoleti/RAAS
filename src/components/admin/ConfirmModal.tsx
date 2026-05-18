'use client'

interface Props {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  title, message, confirmLabel = 'Confirm',
  destructive = false, loading = false,
  onConfirm, onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-brand-card border border-brand-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-brand-gold font-bold text-lg mb-2">{title}</h3>
        <p className="text-brand-body text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2 border border-brand-border rounded-lg text-brand-body text-sm font-medium hover:border-brand-gold transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
              destructive
                ? 'bg-brand-error text-white hover:bg-red-600'
                : 'bg-brand-gold text-brand-bg hover:bg-yellow-400'
            }`}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
