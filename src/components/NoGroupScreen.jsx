import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAppContext } from '../contexts/AppContext.jsx'

export default function NoGroupScreen() {
  const { refreshProfile, refreshMemberships } = useAppContext()

  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  async function handleJoin(e) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('rejoin_with_invite_code', { p_invite_code: trimmed })
    if (rpcError) {
      setError(rpcError.message === 'invalid invite code' ? 'Invalid invite code. Please check and try again.' : rpcError.message)
      setLoading(false)
      return
    }
    await Promise.all([refreshProfile(), refreshMemberships()])
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="fixed inset-0 bg-sunrise-50 flex flex-col items-center justify-center px-6" style={{ paddingTop: 'var(--sat, env(safe-area-inset-top))', paddingBottom: 'var(--sab, env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-ember/10 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M128 24C70.562 24 24 70.562 24 128s46.562 104 104 104 104-46.562 104-104S185.438 24 128 24zm0 192c-48.523 0-88-39.477-88-88s39.477-88 88-88 88 39.477 88 88-39.477 88-88 88zm-8-136v56a8 8 0 0016 0V80a8 8 0 00-16 0zm8 96a12 12 0 100-24 12 12 0 000 24z" fill="#A85228"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-stone-800 mb-2">No group found</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Your group was removed and you're no longer part of one. Enter an invite code to join a new group.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Enter invite code"
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent text-center tracking-widest font-mono text-base uppercase"
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full py-3 bg-ember text-white text-sm font-semibold rounded-xl hover:bg-ember-700 transition-colors disabled:opacity-40"
          >
            {loading ? 'Joining…' : 'Join Group'}
          </button>
        </form>

        <button
          onClick={handleSignOut}
          className="w-full mt-4 py-2.5 text-sm text-stone-400 hover:text-stone-600 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
