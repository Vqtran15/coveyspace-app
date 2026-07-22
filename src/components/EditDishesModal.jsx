import { useState } from 'react'
import { useModalClose } from '../hooks/useModalClose.js'

const CATEGORIES = ['Main', 'Side', 'Dessert', 'Other']

const CATEGORY_STYLES = {
  Main:    'bg-coral/15 text-coral-700 border-coral/30',
  Side:    'bg-lagoon/15 text-lagoon-700 border-lagoon/30',
  Dessert: 'bg-amber-50 text-amber-600 border-amber-200',
  Other:   'bg-stone-100 text-stone-600 border-stone-300',
}

export default function EditDishesModal({ page, noun, pageNoun, signups, onClose, onSave, onDelete, supportsCategories = false }) {
  const [closing, close] = useModalClose(onClose)
  const [title, setTitle]   = useState(page.title)
  const [date, setDate]     = useState(page.week_date)
  const [entries, setEntries] = useState(() =>
    Array.from({ length: page.slot_count }, (_, i) => ({
      key: `o${i}`,
      dish: page.slot_dishes?.[i] ?? '',
      category: page.slot_categories?.[i] ?? '',
      origSlot: i + 1,
    }))
  )
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete()
    } catch (err) {
      setError(err.message ?? 'Could not delete page.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  function signupForEntry(entry) {
    return entry.origSlot ? signups.find(s => s.slot_number === entry.origSlot) : null
  }

  function updateDish(key, value) {
    setEntries(prev => prev.map(e => e.key === key ? { ...e, dish: value } : e))
  }

  function updateCategory(key, value) {
    setEntries(prev => prev.map(e => e.key === key ? { ...e, category: e.category === value ? '' : value } : e))
  }

  function removeEntry(key) {
    setEntries(prev => prev.filter(e => e.key !== key))
  }

  function addSlot() {
    setEntries(prev => [...prev, { key: `n${Date.now()}`, dish: '', category: '', origSlot: null }])
  }

  const removedWithSignups = (() => {
    const keptOrig = new Set(entries.filter(e => e.origSlot).map(e => e.origSlot))
    return signups.filter(s => !keptOrig.has(s.slot_number))
  })()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)

    const newDishes     = entries.map(e => e.dish.trim())
    const newCategories = entries.map(e => e.category)

    const keptOrig = new Set(entries.filter(e => e.origSlot).map(e => e.origSlot))
    const removedOrigSlots = Array.from(
      { length: page.slot_count }, (_, i) => i + 1
    ).filter(n => !keptOrig.has(n))

    const renames = entries
      .map((entry, newIndex) =>
        entry.origSlot !== null && entry.origSlot !== newIndex + 1
          ? { from: entry.origSlot, to: newIndex + 1 }
          : null
      )
      .filter(Boolean)
      .sort((a, b) => a.to - b.to)

    try {
      await onSave({ newTitle: title.trim(), newDate: date, newDishes, newCategories, removedOrigSlots, renames })
    } catch (err) {
      setError(err.message ?? 'Could not save.')
      setSaving(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="text-xl font-bold text-stone-800">Edit {pageNoun}</h2>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        {removedWithSignups.length > 0 && (
          <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 shrink-0">
            Removing{' '}
            {removedWithSignups.map((s, i) => (
              <span key={s.id}>
                <strong>{s.name}</strong>
                {i < removedWithSignups.length - 1 ? ', ' : "'s"}
              </span>
            ))}{' '}
            sign-up{removedWithSignups.length > 1 ? 's' : ''}.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 pb-4 shrink-0 space-y-3">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="px-6 pb-2 space-y-3 overflow-y-auto flex-1">
            {entries.map((entry, i) => {
              const signup = signupForEntry(entry)
              return (
                <div key={entry.key} className="flex items-start gap-2">
                  <span className="text-xs text-stone-400 w-20 shrink-0 text-right pt-2">
                    {noun} {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={entry.dish}
                      onChange={e => updateDish(entry.key, e.target.value)}
                      placeholder=""
                      className="w-full border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
                    />
                    {signup && (
                      <p className="text-xs text-jade mt-0.5 pl-1">
                        Signed up: {signup.name}
                      </p>
                    )}
                    {supportsCategories && (
                      <div className="flex gap-1 mt-1.5">
                        {CATEGORIES.map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => updateCategory(entry.key, cat)}
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all ${
                              entry.category === cat
                                ? CATEGORY_STYLES[cat]
                                : 'border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-500'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.key)}
                    title={signup ? `Remove — will also remove ${signup.name}'s sign-up` : `Remove ${noun.toLowerCase()}`}
                    className="mt-1.5 w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors text-lg leading-none"
                  >
                    &times;
                  </button>
                </div>
              )
            })}

            <button
              type="button"
              onClick={addSlot}
              className="w-full py-2 mt-1 border-2 border-dashed border-stone-300 hover:border-coral text-stone-500 hover:text-jade rounded-lg text-sm font-medium transition-colors"
            >
              + Add another {noun.toLowerCase()}
            </button>
          </div>

          <div className="px-6 py-4 border-t border-stone-100 shrink-0 space-y-3">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={close}
                className="flex-1 py-2 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || entries.length === 0}
                className="flex-1 py-2 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white rounded-lg font-medium disabled:opacity-40 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
              >
                Delete this page
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="text-sm text-red-700 flex-1">
                  Delete page and all sign-ups?
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-sm text-stone-500 hover:text-stone-700 font-medium px-2 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-3 py-1 rounded-lg disabled:opacity-40 transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
