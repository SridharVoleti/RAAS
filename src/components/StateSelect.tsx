import { INDIAN_STATES_AND_UTS, OUTSIDE_INDIA } from '@/lib/indian-states'

interface StateSelectProps {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder: string
  outsideIndiaLabel: string
}

export function StateSelect({ value, onChange, label, placeholder, outsideIndiaLabel }: StateSelectProps) {
  return (
    <div>
      <label className="block text-brand-gold-muted text-xs font-semibold mb-1.5">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 bg-brand-bg border border-brand-border rounded-lg text-brand-body text-sm focus:outline-none focus:border-brand-gold transition-colors"
      >
        <option value="">{placeholder}</option>
        {INDIAN_STATES_AND_UTS.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
        <option value={OUTSIDE_INDIA}>{outsideIndiaLabel}</option>
      </select>
    </div>
  )
}
