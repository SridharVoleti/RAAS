'use client'

export function LanguageUnavailableModal({ message, switchLabel, onSwitch }: {
  message: string
  switchLabel: string
  onSwitch: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-brand-card border border-brand-border rounded-2xl p-6 max-w-sm w-full text-center">
        <p className="text-brand-body text-sm leading-relaxed mb-5">{message}</p>
        <button
          onClick={onSwitch}
          className="w-full py-2.5 bg-brand-gold text-brand-bg font-semibold rounded-xl hover:bg-yellow-400 transition-colors"
        >
          {switchLabel}
        </button>
      </div>
    </div>
  )
}
