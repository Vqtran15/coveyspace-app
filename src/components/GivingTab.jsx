import { useState } from 'react'
import { Coins, ArrowSquareOut, ArrowLeft, PencilSimple } from '@phosphor-icons/react'
import { useToast } from '../lib/toast.jsx'

export default function GivingTab({ onClose, givingUrl, isAdmin, onGivingSave }) {
  const [editing, setEditing] = useState(!givingUrl && isAdmin)
  const [url, setUrl]         = useState(givingUrl || '')
  const [saving, setSaving]   = useState(false)
  const toast = useToast()

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const trimmed = url.trim()
    const normalized = trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed
    const { error } = await onGivingSave(normalized || null)
    if (error) {
      toast('Failed to save giving link', 'error')
    } else {
      toast('Giving link saved', 'success')
      setEditing(false)
    }
    setSaving(false)
  }

  async function handleRemove() {
    setSaving(true)
    const { error } = await onGivingSave(null)
    if (error) {
      toast('Failed to remove giving link', 'error')
    } else {
      toast('Giving link removed', 'success')
      setUrl('')
      setEditing(false)
    }
    setSaving(false)
  }

  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={editing && givingUrl ? () => setEditing(false) : onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        {!editing && isAdmin && givingUrl && (
          <button
            onClick={() => { setUrl(givingUrl); setEditing(true) }}
            className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors"
          >
            <PencilSimple size={16} weight="bold" />
            Edit
          </button>
        )}
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-sage-700 flex items-center justify-center mb-5">
          <Coins size={44} weight="fill" className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-stone-800 mb-2">Giving</h1>

        {editing ? (
          <>
            <p className="text-stone-500 text-sm mb-8 max-w-xs">Paste a link to your church's giving or tithing page.</p>
            <form onSubmit={handleSave} className="w-full max-w-xs flex flex-col gap-3">
              <input
                autoFocus
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://church.com/give"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-sage-700 focus:border-transparent"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => givingUrl ? setEditing(false) : onClose()}
                  className="flex-1 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !url.trim()}
                  className="flex-1 py-2.5 bg-sage-700 rounded-xl text-sm font-medium text-white hover:bg-sage-700 transition-colors disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
              {givingUrl && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={saving}
                  className="w-full py-2 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  Remove link
                </button>
              )}
            </form>
          </>
        ) : givingUrl ? (
          <>
            <p className="text-stone-500 text-sm mb-8 max-w-xs">Support your church or community through your giving.</p>
            <button
              onClick={() => window.open(givingUrl, '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-2 px-6 py-3 bg-sage-700 hover:bg-sage-700 active:bg-sage-700 text-white font-medium rounded-xl transition-colors"
            >
              Open Giving Page
              <ArrowSquareOut size={18} weight="bold" />
            </button>
          </>
        ) : isAdmin ? (
          <>
            <p className="text-stone-500 text-sm mb-8 max-w-xs">Set up a giving link so your community can donate in one tap.</p>
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 px-6 py-3 bg-sage-700 hover:bg-sage-700 active:bg-sage-700 text-white font-medium rounded-xl transition-colors"
            >
              Add giving link
            </button>
          </>
        ) : (
          <p className="text-sm text-stone-400 max-w-xs mt-2">
            No giving link available yet. Ask your admin to set one up.
          </p>
        )}
      </div>
    </div>
  )
}
