import { AlertTriangle } from 'lucide-react'

// Legal notice text kept verbatim/English-only regardless of site language,
// since this is compliance wording, not general UI copy.
export function FcraNotice() {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
      <p className="flex items-center gap-2 text-red-400 font-semibold text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        Important Notice
      </p>
      <p className="text-red-300 text-xs leading-relaxed">
        Sri Krishnamargam Trust currently accepts donations only from eligible Indian domestic sources.
        We are not registered under the Foreign Contribution (Regulation) Act (FCRA) and therefore cannot
        accept foreign contributions. If a donation is found to be ineligible under applicable laws, the
        Trust reserves the right to reject or refund the contribution.
      </p>
    </div>
  )
}
