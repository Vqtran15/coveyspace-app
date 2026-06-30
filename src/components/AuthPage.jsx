import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { UsersThree, ArrowLeft } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'

const MODE_ORDER = { signin: 0, forgot: 1, signup: 2 }

export default function AuthPage() {
  const [searchParams] = useSearchParams()
  const [mode, setMode]             = useState(searchParams.get('tab') === 'signup' ? 'signup' : 'signin')
  const [joinMode, setJoinMode]     = useState('join') // 'join' | 'create'
  const [displayName, setDisplayName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [notice, setNotice]         = useState(null)
  const [animKey, setAnimKey]       = useState(0)
  const [animDir, setAnimDir]       = useState(null)

  function switchMode(next) {
    setAnimDir(MODE_ORDER[next] > MODE_ORDER[mode] ? 'right' : 'left')
    setAnimKey(k => k + 1)
    setMode(next)
    setError(null)
    setNotice(null)
    if (next === 'signup') {
      setJoinMode('join')
      setInviteCode('')
      setNewGroupName('')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    if (mode === 'forgot') {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (err) {
        setError(err.message)
      } else {
        switchMode('signin')
        setNotice('Check your email for a password reset link.')
      }
      setLoading(false)
      return
    }

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        setLoading(false)
        return
      }
      if (!displayName.trim()) {
        setError('Please enter your name.')
        setLoading(false)
        return
      }

      let metadata
      if (joinMode === 'join') {
        if (!inviteCode.trim()) {
          setError('Please enter an invite code.')
          setLoading(false)
          return
        }
        metadata = { display_name: displayName.trim(), invite_code: inviteCode.trim().toUpperCase() }
      } else {
        if (!newGroupName.trim()) {
          setError('Please enter a group name.')
          setLoading(false)
          return
        }
        metadata = { display_name: displayName.trim(), community_group_name: newGroupName.trim() }
      }

      const { error: err } = await supabase.auth.signUp({ email, password, options: { data: metadata } })
      if (err) {
        setError(err.message)
      } else {
        window.dataLayer = window.dataLayer || []
        window.dataLayer.push({ event: 'sign_up', method: joinMode === 'create' ? 'create_group' : 'join_group' })
        switchMode('signin')
        setNotice(
          joinMode === 'create'
            ? 'Group created! Check your email to confirm, then sign in. Find your invite code in Admin settings.'
            : 'Account created! Check your email to confirm, then sign in.'
        )
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError(err.message)
      } else {
        window.dataLayer = window.dataLayer || []
        window.dataLayer.push({ event: 'login', method: 'email' })
      }
    }

    setLoading(false)
  }

  const inputClass =
    'w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent transition-shadow text-sm'

  const animClass =
    animDir === 'right' ? 'animate-slide-in-right' : animDir === 'left' ? 'animate-slide-in-left' : ''

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-jade-50 to-white flex items-start justify-center p-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 2.5rem)' }}
    >
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden">
          {/* Logo inside card */}
          <div className="pt-7 pb-5 text-center border-b border-stone-100">
            <div className="inline-flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-jade ring-4 ring-jade/20 flex items-center justify-center shrink-0">
                <UsersThree size={24} weight="fill" className="text-white" />
              </div>
              <h1 className="font-league-gothic text-5xl tracking-wide text-jade">Covey Space</h1>
            </div>
          </div>

          {/* Mode toggle tabs */}
          <div className="flex border-b border-stone-100">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                mode === 'signin' || mode === 'forgot'
                  ? 'text-jade border-b-2 border-jade -mb-px'
                  : 'text-stone-400'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                mode === 'signup'
                  ? 'text-jade border-b-2 border-jade -mb-px'
                  : 'text-stone-400'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Animated form content */}
          <div key={animKey} className={animClass}>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">

              {/* Forgot password sub-header */}
              {mode === 'forgot' && (
                <div className="flex items-center gap-2 -mt-1 mb-1">
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="text-stone-400 transition-colors p-1 -ml-1 rounded-lg hover:bg-stone-100"
                  >
                    <ArrowLeft size={16} weight="bold" />
                  </button>
                  <span className="text-sm font-semibold text-stone-700">Forgot your password?</span>
                </div>
              )}

              {/* Signup-only fields */}
              {mode === 'signup' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="e.g. Jane Smith"
                      required
                      autoComplete="name"
                      className={inputClass}
                    />
                  </div>

                  {/* Join vs Create toggle */}
                  <div className="flex rounded-xl border border-stone-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setJoinMode('join')}
                      className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                        joinMode === 'join' ? 'bg-jade text-white' : 'text-stone-400'
                      }`}
                    >
                      Join a Group
                    </button>
                    <button
                      type="button"
                      onClick={() => setJoinMode('create')}
                      className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                        joinMode === 'create' ? 'bg-jade text-white' : 'text-stone-400'
                      }`}
                    >
                      Start New Group
                    </button>
                  </div>

                  {joinMode === 'join' ? (
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
                        Invite Code
                      </label>
                      <input
                        type="text"
                        value={inviteCode}
                        onChange={e => setInviteCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                        placeholder="e.g. A3B7C2"
                        required
                        autoComplete="off"
                        className={`${inputClass} font-mono tracking-widest text-center text-base`}
                      />
                      <p className="text-xs text-stone-400 mt-1.5">
                        Ask your group leader for the 6-character invite code.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
                        Group Name
                      </label>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={e => setNewGroupName(e.target.value)}
                        placeholder="e.g. Lake Oswego & SE"
                        required
                        autoComplete="organization"
                        className={inputClass}
                      />
                      <p className="text-xs text-stone-400 mt-1.5">
                        Once signed in, find your invite code in Admin settings to share with members.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className={inputClass}
                />
                {mode === 'forgot' && (
                  <p className="text-xs text-stone-400 mt-1">We'll send a reset link to this address.</p>
                )}
              </div>

              {/* Password */}
              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                      Password
                    </label>
                    {mode === 'signin' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot')}
                        className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    className={inputClass}
                  />
                  {mode === 'signup' && (
                    <p className="text-xs text-stone-400 mt-1">Minimum 6 characters</p>
                  )}
                </div>
              )}

              {/* Confirm password */}
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5 uppercase tracking-wide">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </div>
              )}

              {error && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}
              {notice && (
                <div className="text-sm text-jade bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                  {notice}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-jade active:scale-[0.98] text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading
                  ? 'Please wait…'
                  : mode === 'signin'
                  ? 'Sign In'
                  : mode === 'forgot'
                  ? 'Send Reset Link'
                  : joinMode === 'join'
                  ? 'Join Group'
                  : 'Create Group & Account'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
