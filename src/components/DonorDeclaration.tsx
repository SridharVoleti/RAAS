// Legal declaration text kept verbatim/English-only regardless of site language,
// same rationale as FcraNotice — this is compliance wording, not general UI copy.
const DECLARATIONS = [
  'I am eligible to make this donation under the applicable laws of India.',
  'This donation is being made from my own Indian bank account.',
  'This contribution does not constitute a foreign contribution under the Foreign Contribution (Regulation) Act (FCRA).',
  'The information provided by me is true and correct.',
  'I understand that Sri Krishnamargam Trust may reject or refund any donation that does not comply with applicable laws.',
]

interface DonorDeclarationProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

export function DonorDeclaration({ checked, onChange }: DonorDeclarationProps) {
  return (
    <div className="bg-brand-bg border border-brand-border rounded-xl p-4 space-y-2">
      <p className="text-brand-gold text-xs font-semibold">Donor Declaration</p>
      <p className="text-brand-gold-muted text-xs">I hereby declare that:</p>
      <ul className="list-disc list-inside space-y-1 text-brand-gold-muted text-xs">
        {DECLARATIONS.map(d => <li key={d}>{d}</li>)}
      </ul>
      <label className="flex items-start gap-2 text-brand-body text-xs cursor-pointer select-none pt-1">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="accent-brand-gold w-4 h-4 mt-0.5 flex-shrink-0"
        />
        <span>I agree to the above declaration and wish to proceed with my donation.</span>
      </label>
    </div>
  )
}
