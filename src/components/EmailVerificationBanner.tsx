'use client'

import { useState } from 'react'

type State = 'idle' | 'sending' | 'sent' | 'error'

export default function EmailVerificationBanner() {
  const [state, setState] = useState<State>('idle')

  async function handleVerify() {
    setState('sending')
    try {
      const res = await fetch('/api/auth/send-verification', { method: 'POST' })
      setState(res.ok ? 'sent' : 'error')
    } catch {
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="w-full bg-green-800 border-b border-green-600 text-green-100 text-sm text-center py-2 px-4">
        Verification email sent — check your inbox and click the link to verify your account.
      </div>
    )
  }

  return (
    <div className="w-full bg-red-900 border-b border-red-700 text-center py-2 px-4 flex items-center justify-center gap-2">
      <span className="text-red-200 text-sm">Your email is not verified.</span>
      <button
        onClick={handleVerify}
        disabled={state === 'sending'}
        className="text-sm font-semibold text-white underline underline-offset-2 hover:text-red-200 disabled:opacity-60 transition-colors"
      >
        {state === 'sending' ? 'Sending…' : 'Click here to verify →'}
      </button>
      {state === 'error' && (
        <span className="text-red-300 text-xs ml-1">Failed to send. Try again.</span>
      )}
    </div>
  )
}
