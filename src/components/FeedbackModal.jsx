import { useState, useEffect } from 'react'
import { ChatTeardropDots, CheckCircle } from '@phosphor-icons/react'
import { useModalClose } from '../hooks/useModalClose.js'
import { supabase } from '../lib/supabase.js'
import { trackEvent } from '../lib/analytics.js'

const TYPES = [
  { key: 'bug',     label: 'Bug Report' },
  { key: 'feature', label: 'Feature Idea' },
  { key: 'general', label: 'General' },
]

export default function FeedbackModal({ userId, displayName, email, onClose }) {
  const [closing, close] = useModalClose(onClose)
  const [type, setType]       = useState('general')
  const [message, setMessage] = useState('')
  const [groupName, setGroupName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]           = useState(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onResize() {
      setKeyboardHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    supabase
      .from('profiles')
      .select('community_groups(name)')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setGroupName(data?.community_groups?.name ?? '')
      })
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
      className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight + 16 } : undefined}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 shrink-0">
          <div className="flex items-center gap-2">
            <ChatTeardropDots size={20} weight="fill" className="text-jade" />
            <h2 className="text-lg font-bold text-stone-800">Send Feedback</h2>
          </div>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        <div className="px-5 pb-6">
          {submitted ? (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <CheckCircle size={44} weight="fill" className="text-jade" />
              <p className="font-semibold text-stone-800">Thanks for the feedback!</p>
              <p className="text-sm text-stone-400 leading-relaxed">
                I read every response and use it to make Covey Space better.
              </p>
              <button
                onClick={close}
                className="mt-2 px-6 py-2.5 bg-jade text-white text-sm font-semibold rounded-xl hover:bg-jade-700 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type selector */}
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Type</p>
                <div className="flex gap-2">
                  {TYPES.map(({ key, label }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setType(key)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-colors ${
                        type === key
                          ? 'bg-jade text-white'
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Message</p>
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
                  rows={5}
                  maxLength={2000}
                  required
                  className="w-full text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-jade placeholder:text-stone-300 resize-none"
                />
                <p className="text-right text-xs text-stone-300 mt-1">{message.length}/2000</p>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="w-full py-3 bg-jade text-white text-sm font-semibold rounded-xl hover:bg-jade-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
