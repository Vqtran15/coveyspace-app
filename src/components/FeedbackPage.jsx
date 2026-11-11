import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChatTeardropDots, CheckCircle } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { trackEvent } from '../lib/analytics.js'

const TYPES = [
  { key: 'bug',     label: 'Bug Report' },
  { key: 'feature', label: 'Feature Idea' },
  { key: 'general', label: 'General' },
]

export default function FeedbackPage() {
  const navigate = useNavigate()
  const { userId, displayName, session } = useAppContext()
  const email = session?.user?.email

  const [type, setType]           = useState('general')
  const [message, setMessage]     = useState('')
  const [groupName, setGroupName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('community_groups(name)')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => setGroupName(data?.community_groups?.name ?? ''))
  }, [userId])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    setError(null)

    const { error: insertError } = await supabase.from('feedback').insert({
      user_id:      userId,
      display_name: displayName,
      email,
      group_name:   groupName,
      type,
      message:      message.trim(),
    })

    if (insertError) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
      return
    }

    trackEvent('feedback_submitted', { feedback_type: type })
    setSubmitted(true)
    setSubmitting(false)
  }

  return (
    <div
      className="bg-sunrise-50 flex flex-col"
      style={{ minHeight: '100dvh', paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}
    >
      {/* Header */}
      <div className="bg-sunrise-50 px-4 pt-4 pb-2 flex items-center gap-1 shrink-0">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors -ml-2 shrink-0"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <h1 className="text-3xl font-bold text-stone-800">Feedback</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-4 pt-4 pb-10">
          {submitted ? (
            <div className="flex flex-col items-center text-center py-16 gap-4">
              <CheckCircle size={56} weight="fill" className="text-ember" />
              <div>
                <p className="text-xl font-bold text-stone-800">Thanks for the feedback!</p>
                <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                  I read every response and use it to make Coveyspace better.
                </p>
              </div>
              <button
                onClick={() => navigate(-1)}
                className="mt-2 px-6 py-2.5 bg-ember text-white text-sm font-semibold rounded-xl hover:bg-ember-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Type selector */}
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Type</p>
                <div className="flex gap-2">
                  {TYPES.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setType(key)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold transition-colors ${
                        type === key
                          ? 'bg-ember text-white'
                          : 'bg-white border border-stone-200 text-stone-500 hover:border-ember hover:text-ember'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Message</p>
                <textarea
                  autoFocus
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={
                    type === 'bug'
                      ? 'Describe what happened and how to reproduce it…'
                      : type === 'feature'
                      ? 'Describe the feature and why it would help your group…'
                      : 'Share any thoughts, questions, or suggestions…'
                  }
                  rows={7}
                  maxLength={2000}
                  required
                  className="w-full text-sm bg-white border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent placeholder:text-stone-400 resize-none"
                />
                <p className="text-right text-xs text-stone-400 mt-1">{message.length}/2000</p>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="w-full py-3 bg-ember text-white text-sm font-semibold rounded-xl hover:bg-ember-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? 'Sending…' : 'Send Feedback'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
