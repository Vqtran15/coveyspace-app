import { useState } from 'react'
import { BookOpen, ArrowSquareOut, ArrowLeft, Link } from '@phosphor-icons/react'
import { useModalClose } from '../hooks/useModalClose.js'

function AddGuideModal({ onClose, onSave }) {
  const [closing, close] = useModalClose(onClose)
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error: saveError } = await onSave(url)
    if (saveError) { setError('Failed to save. Please try again.'); setSaving(false) }
    else close()
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={20} weight="fill" className="text-jade" />
            <h2 className="text-lg font-bold text-stone-800">Add Community Guide</h2>
          </div>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 pb-6 space-y-4">
          <input
            autoFocus
            type="text"
            value={url}
            onChange={e => { setUrl(e.target.value); setError(null) }}
            placeholder="https://example.com/guide"
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={saving || !url.trim()}
            className="w-full py-2.5 bg-jade hover:bg-jade-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function GuideTab({ onClose, guideUrl, isAdmin, onGuideUrlSave }) {
  const [addingGuide, setAddingGuide] = useState(false)

  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12">
      <div className="flex items-center justify-end mb-8">
        {onClose && (
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
        )}
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-jade flex items-center justify-center mb-5">
          <BookOpen size={44} weight="fill" className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-stone-800 mb-2">Guide</h1>
        <p className="text-stone-500 text-sm mb-8 max-w-xs">
          Read the latest guide posts from your community.
        </p>
        {guideUrl ? (
          <button
            onClick={() => window.open(guideUrl, '_blank', 'noopener,noreferrer')}
            className="flex items-center gap-2 px-6 py-3 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white font-medium rounded-xl transition-colors"
          >
            Open Guide
            <ArrowSquareOut size={18} weight="bold" />
          </button>
        ) : isAdmin ? (
          <button
            onClick={() => setAddingGuide(true)}
            className="flex items-center gap-2 px-6 py-3 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white font-medium rounded-xl transition-colors"
          >
            Add a guide
            <Link size={18} weight="bold" />
          </button>
        ) : (
          <p className="text-sm text-stone-400 max-w-xs">
            No guide available. Please ask your admin to upload the guide.
          </p>
        )}
      </div>

      {addingGuide && (
        <AddGuideModal
          onClose={() => setAddingGuide(false)}
          onSave={onGuideUrlSave}
        />
      )}
    </div>
  )
}
