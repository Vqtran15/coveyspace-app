import { useState, useEffect, useRef } from 'react'
import { useModalClose } from '../hooks/useModalClose.js'

const CATEGORIES = ['Main', 'Side', 'Dessert', 'Other']

const CATEGORY_STYLES = {
  Main:    'bg-coral/15 text-coral-700 border-coral/30',
  Side:    'bg-lagoon/15 text-lagoon-700 border-lagoon/30',
  Dessert: 'bg-amber-50 text-amber-600 border-amber-200',
  Other:   'bg-stone-100 text-stone-600 border-stone-300',
}

export default function SignupModal({ slot, itemNoun, dishName, category: initialCategory = '', signup, onClose, onSave, onRemove, onDeleteItem }) {
  const [closing, close] = useModalClose(onClose)
  const overlayRef = useRef(null)
  const modalRef   = useRef(null)
  const [name, setName]     = useState(signup?.name ?? '')
  const [dish, setDish]     = useState(dishName ?? '')
  const [category, setCategory] = useState(initialCategory)
  const [notes, setNotes]   = useState(signup?.notes ?? '')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving]     = useState(false)
  const [confirmDeleteItem, setConfirmDeleteItem] = useState(false)
  const [deletingItem, setDeletingItem]           = useState(false)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      if (!overlayRef.current || !modalRef.current) return
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      if (offset > 0) {
        overlayRef.current.style.paddingBottom = `${offset}px`
        modalRef.current.style.maxHeight = `${vv.height - 16}px`
      } else {
        overlayRef.current.style.paddingBottom = ''
        modalRef.current.style.maxHeight = ''
      }
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), dish: dish.trim(), category, notes: notes.trim() })
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    setError(null)
    try {
      await onRemove()
    } catch (err) {
      setError(err.message ?? 'Could not remove sign-up.')
      setRemoving(false)
      setConfirmRemove(false)
    }
  }

  async function handleDeleteItem() {
    setDeletingItem(true)
    setError(null)
    try {
      await onDeleteItem()
    } catch (err) {
      setError(err.message ?? `Could not delete this ${itemNoun.toLowerCase()}.`)
      setDeletingItem(false)
      setConfirmDeleteItem(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        ref={modalRef}
        className={`bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4">
          <div>
            <h2 className="text-xl font-bold text-stone-800">
              {signup ? 'Edit Sign-Up' : 'Sign Up'}
            </h2>
          </div>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        <div className="mx-6 mb-4">
          <label className="block text-xs font-medium text-jade uppercase tracking-wide mb-1">{itemNoun}</label>
          <input
            type="text"
            value={dish}
            onChange={e => setDish(e.target.value)}
            placeholder={`Add a ${itemNoun.toLowerCase()}`}
            className="w-full bg-jade-50 border border-lagoon-200 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
          />
          <div className="flex gap-2 mt-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                onPointerDown={e => e.preventDefault()}
                onClick={() => setCategory(prev => prev === cat ? '' : cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                  category === cat
                    ? CATEGORY_STYLES[cat]
                    : 'border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Chipotle"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Notes <span className="text-stone-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder=""
              rows={2}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white rounded-lg font-medium disabled:opacity-40 transition-colors"
          >
            {saving ? 'Saving…' : signup ? 'Update' : 'Sign Up'}
          </button>

          {signup && (
            !confirmRemove ? (
              <button
                type="button"
                onClick={() => { setConfirmDeleteItem(false); setConfirmRemove(true) }}
                disabled={saving}
                className="w-full py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors text-sm font-medium"
              >
                Remove my name
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="text-sm text-red-700 flex-1">Remove your sign-up?</span>
                <button
                  type="button"
                  onClick={() => setConfirmRemove(false)}
                  disabled={removing}
                  className="text-sm text-stone-500 hover:text-stone-700 font-medium px-3 py-2.5 min-h-[44px] disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={removing}
                  className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-4 py-2.5 min-h-[44px] rounded-lg disabled:opacity-40 transition-colors"
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
              </div>
            )
          )}

          {!confirmDeleteItem ? (
            <button
              type="button"
              onClick={() => { setConfirmRemove(false); setConfirmDeleteItem(true) }}
              disabled={saving}
              className="w-full py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors text-sm font-medium"
            >
              Delete this {itemNoun.toLowerCase()}
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-sm text-red-700 flex-1">
                Delete this {itemNoun.toLowerCase()}{signup ? ' and its sign-up' : ''}?
              </span>
              <button
                type="button"
                onClick={() => setConfirmDeleteItem(false)}
                disabled={deletingItem}
                className="text-sm text-stone-500 hover:text-stone-700 font-medium px-3 py-2.5 min-h-[44px] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteItem}
                disabled={deletingItem}
                className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-4 py-2.5 min-h-[44px] rounded-lg disabled:opacity-40 transition-colors"
              >
                {deletingItem ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
