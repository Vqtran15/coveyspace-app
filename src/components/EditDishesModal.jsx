import { useState } from 'react'
import { ArrowLeft, Plus, X } from '@phosphor-icons/react'

const ANIM_OUT = 200  // matches slide-out-right 0.2s

const CATEGORIES = ['Main', 'Side', 'Dessert', 'Other']

const CATEGORY_STYLES = {
  Main:    'bg-coral/15 text-coral-700 border-coral/30',
  Side:    'bg-lagoon/15 text-lagoon-700 border-lagoon/30',
  Dessert: 'bg-amber-50 text-amber-600 border-amber-200',
  Other:   'bg-stone-100 text-stone-600 border-stone-300',
}

export default function EditDishesModal({ page, noun, pageNoun, signups, onClose, onSave, onDelete, supportsCategories = false }) {
  const [exiting, setExiting] = useState(false)
  const [title, setTitle]     = useState(page.title)
  const [date, setDate]       = useState(page.week_date)
  const [location, setLocation] = useState(page.location ?? '')
  const [entries, setEntries] = useState(() =>
    Array.from({ length: page.slot_count }, (_, i) => ({
      key: `o${i}`,
      dish: page.slot_dishes?.[i] ?? '',
      category: page.slot_categories?.[i] ?? '',
      origSlot: i + 1,
    }))
  )
  const [columns, setColumns]   = useState(page.slot_columns ?? 1)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function handleClose() {
    setExiting(true)
    setTimeout(onClose, ANIM_OUT)
  }

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
      await onSave({ newTitle: title.trim(), newDate: date, newLocation: location.trim() || null, newDishes, newCategories, newColumns: columns, removedOrigSlots, renames })
      setExiting(true)
      setTimeout(onClose, ANIM_OUT)
    } catch (err) {
      setError(err.message ?? 'Could not save.')
      setSaving(false)
    }
  }

  const inputClass = 'w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent bg-white'
  const labelClass = 'block text-sm font-semibold text-stone-700 mb-1.5'

  return (
    <div
      data-overlay="true"
      className={`fixed inset-0 lg:left-56 z-[60] bg-sunrise-50 flex flex-col ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-8 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            aria-label="Back"
            className="w-9 h-9 flex items-center justify-center rounded-full text-stone-500 hover:text-stone-800 hover:bg-stone-200 active:bg-stone-300 transition-colors shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="flex-1 text-3xl font-bold text-stone-800">Edit {pageNoun}</h1>
        </div>
      </div>

      {/* Scrollable form */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="max-w-3xl mx-auto px-4 pb-6 space-y-4">

          {removedWithSignups.length > 0 && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
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

          <div>
            <label className={labelClass}>Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Date</label>
            <div className="overflow-hidden rounded-xl border border-stone-200 focus-within:ring-2 focus-within:ring-ember bg-white">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', display: 'block' }}
                className="px-4 py-3 text-sm text-stone-800 focus:outline-none bg-white appearance-none"
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Location <span className="text-stone-400 font-normal">— optional</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. 123 Main St or John's house"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Sign-up layout</label>
            <p className="text-xs text-stone-400 mb-2">How {noun.toLowerCase()}s appear on the sign-up page for members</p>
            <div className="inline-flex bg-stone-100 rounded-xl p-1">
              {[1, 2].map(n => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={columns === n}
                  onClick={() => setColumns(n)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    columns === n
                      ? 'bg-ember text-white shadow-sm'
                      : 'text-stone-500 hover:text-stone-700'
                  }`}
                >
                  {n === 1 ? '1 column' : '2 columns'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>{noun}s</label>
            <div className="flex flex-col gap-2">
              {entries.map((entry, i) => {
                const signup = signupForEntry(entry)
                return (
                  <div key={entry.key} className="bg-white rounded-2xl border border-stone-100 shadow-sm px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium shrink-0 whitespace-nowrap ${entry.dish ? 'text-stone-300' : 'text-stone-400'}`}>
                        {noun} {i + 1}
                      </span>
                      <input
                        type="text"
                        value={entry.dish}
                        onChange={e => updateDish(entry.key, e.target.value)}
                        placeholder="—"
                        className="flex-1 appearance-none text-base text-stone-800 placeholder:text-stone-300 bg-transparent focus:outline-none min-w-0"
                      />
                      <button
                        type="button"
                        onClick={() => removeEntry(entry.key)}
                        title={signup ? `Remove — will also remove ${signup.name}'s sign-up` : `Remove ${noun.toLowerCase()}`}
                        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-stone-300 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors"
                      >
                        <X size={14} weight="bold" />
                      </button>
                    </div>
                    {signup && (
                      <p className="text-xs text-ember mt-1 pl-0">
                        Signed up: {signup.name}
                      </p>
                    )}
                    {supportsCategories && (
                      <div className="flex gap-1.5 mt-2">
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
                )
              })}
              <button
                type="button"
                onClick={addSlot}
                className="flex items-center gap-2 px-1 py-2 text-sm font-medium text-ember hover:text-ember-700 transition-colors"
              >
                <Plus size={16} weight="bold" />
                Add another {noun.toLowerCase()}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Delete zone */}
          <div className="pt-2">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-3 border border-red-200 text-red-500 rounded-xl hover:bg-red-50 active:bg-red-100 transition-colors text-sm font-medium"
              >
                Delete this {pageNoun.toLowerCase()}
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-sm text-red-700 flex-1">
                  Delete and remove all sign-ups?
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
                  className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            )}
          </div>

          <div style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <button
              type="submit"
              disabled={saving || entries.length === 0}
              className="w-full py-3.5 bg-ember hover:bg-ember-700 active:bg-ember-800 text-white font-semibold rounded-2xl transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : `Save ${pageNoun}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
