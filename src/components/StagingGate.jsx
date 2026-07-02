import { useState } from 'react'
import { UsersThree } from '@phosphor-icons/react'

const STAGING_HOST = 'staging.app.coveyspace.com'
const SESSION_KEY  = 'staging_auth'
const PASSWORD     = import.meta.env.VITE_STAGING_PASSWORD

function isStaging() {
  return window.location.hostname === STAGING_HOST
}

export default function StagingGate({ children }) {
  const [authed, setAuthed]   = useState(() => sessionStorage.getItem(SESSION_KEY) === '1')
  const [input, setInput]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState(null)

  if (!isStaging() || authed) return children

  function handleSubmit(e) {
    e.preventDefault()
    if (input !== confirm) {
      setError('mismatch')
      return
    }
    if (input === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setAuthed(true)
    } else {
      setError('wrong')
      setInput('')
      setConfirm('')
    }
  }

  return (
    <div className="min-h-screen bg-sunrise-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 rounded-full bg-jade flex items-center justify-center">
            <UsersThree size={24} weight="fill" className="text-white" />
          </div>
        </div>
        <h1 className="text-center font-league-gothic text-3xl text-jade tracking-wide mb-1">Covey Space</h1>
        <p className="text-center text-stone-400 text-sm mb-8">Staging environment</p>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1.5">Password</label>
            <input
              type="password"
              value={input}
              onChange={e => { setInput(e.target.value); setError(null) }}
              placeholder="Enter staging password"
              autoFocus
              className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors ${
                error === 'wrong' ? 'border-red-400 bg-red-50' : 'border-stone-200 focus:border-jade'
              }`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-500 mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(null) }}
              placeholder="Re-enter staging password"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-colors ${
                error === 'mismatch' ? 'border-red-400 bg-red-50' : 'border-stone-200 focus:border-jade'
              }`}
            />
            {error === 'mismatch' && <p className="text-red-500 text-xs mt-1.5">Passwords do not match</p>}
            {error === 'wrong'    && <p className="text-red-500 text-xs mt-1.5">Incorrect password</p>}
          </div>
          <button
            type="submit"
            className="w-full bg-jade text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-jade-700 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  )
}
