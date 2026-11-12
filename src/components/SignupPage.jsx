import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { trackEvent } from '../lib/analytics.js'
import { haptic } from '../lib/haptic.js'

const CATEGORIES = ['Main', 'Side', 'Dessert', 'Other']
const CATEGORY_STYLES = {
  Main:    'bg-coral/15 text-coral-700 border-coral/30',
  Side:    'bg-lagoon/15 text-lagoon-700 border-lagoon/30',
  Dessert: 'bg-amber-50 text-amber-600 border-amber-200',
  Other:   'bg-stone-100 text-stone-600 border-stone-300',
}

const inputCls = 'w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent bg-white'
const labelCls = 'block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5'

export default function SignupPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const toast     = useToast()

  const state = location.state
  if (!state?.pageId) {
    navigate('/schedule', { replace: true })
    return null
  }

  const {
    slot, itemNoun, noun, dishName: initialDish, category: initialCategory = '',
    signup, supportsCategories = false,
    pageId, pageDishes, pageCategories, pageSlotCount,
    tablesPages, tablesSignups,
  } = state

  const isEdit    = !!signup
  const hasName   = !!initialDish
  const pageTitle = isEdit ? 'Edit Sign-Up' : !hasName ? 'Add Item' : 'Sign Up'

  const [dish,            setDish]            = useState(initialDish ?? '')
  const [category,        setCategory]        = useState(initialCategory)
  const [name,            setName]            = useState(signup?.name ?? '')
  const [notes,           setNotes]           = useState(signup?.notes ?? '')
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState(null)
  const [confirmRemove,   setConfirmRemove]   = useState(false)
  const [removing,        setRemoving]        = useState(false)
  const [confirmDelete,   setConfirmDelete]   = useState(false)
  const [deletingItem,    setDeletingItem]    = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      // Update dish name / category on the page if changed
      if (dish !== initialDish || category !== initialCategory) {
        const newDishes = [...(pageDishes ?? [])]
        while (newDishes.length < slot) newDishes.push('')
        newDishes[slot - 1] = dish

        const newCategories = [...(pageCategories ?? [])]
        while (newCategories.length < slot) newCategories.push('')
        newCategories[slot - 1] = category

        const { error: dishErr } = await supabase
          .from(tablesPages)
          .update({ slot_dishes: newDishes, ...(supportsCategories && { slot_categories: newCategories }) })
          .eq('id', pageId)
        if (dishErr) throw new Error(dishErr.message)
      }

      if (isEdit) {
        const { error } = await supabase
          .from(tablesSignups)
          .update({ name: name.trim(), notes: notes.trim(), updated_at: new Date().toISOString() })
          .eq('id', signup.id)
        if (error) throw new Error(error.message)
        trackEvent('schedule_signup', { page_type: noun?.toLowerCase() })
      } else if (name.trim()) {
        const { error } = await supabase
          .from(tablesSignups)
          .insert({ meal_page_id: pageId, slot_number: slot, name: name.trim(), notes: notes.trim() })
        if (error) {
          if (error.code === '23505') throw new Error(`That ${noun?.toLowerCase()} was just taken — try another!`)
          throw new Error(error.message)
        }
        trackEvent('schedule_signup', { page_type: noun?.toLowerCase() })
      }

      haptic()
      navigate(-1)
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  async function handleRemove() {
    if (!signup) return
    setRemoving(true)
    setError(null)
    try {
      const { error } = await supabase.from(tablesSignups).delete().eq('id', signup.id)
      if (error) throw new Error(error.message)
      trackEvent('schedule_cancel', { page_type: noun?.toLowerCase() })
      haptic()
      navigate(-1)
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
      // Delete all signups for this slot
      await supabase.from(tablesSignups).delete().eq('meal_page_id', pageId).eq('slot_number', slot)

      // Fetch and shift higher slot numbers
      const { data: toShift } = await supabase
        .from(tablesSignups)
        .select('id, slot_number')
        .eq('meal_page_id', pageId)
        .gt('slot_number', slot)
        .order('slot_number')
      for (const s of (toShift ?? [])) {
        await supabase.from(tablesSignups).update({ slot_number: s.slot_number - 1 }).eq('id', s.id)
      }

      const newDishes     = (pageDishes ?? []).filter((_, i) => i !== slot - 1)
      const newCategories = (pageCategories ?? []).filter((_, i) => i !== slot - 1)
      const { error } = await supabase
        .from(tablesPages)
        .update({ slot_count: pageSlotCount - 1, slot_dishes: newDishes, ...(supportsCategories && { slot_categories: newCategories }) })
        .eq('id', pageId)
      if (error) throw new Error(error.message)

      haptic()
      navigate(-1)
    } catch (err) {
      setError(err.message ?? `Could not delete this ${itemNoun?.toLowerCase()}.`)
      setDeletingItem(false)
      setConfirmDelete(false)
    }
  }

  const saveDisabled = saving || (!dish.trim() && !name.trim()) || (isEdit && !name.trim())

  return (
    <div className="min-h-screen bg-sunrise-50">
      <div className="max-w-md mx-auto px-4 pt-8 pb-12">

        {/* Header */}
        <div className="flex items-center gap-1 min-w-0 -ml-2 mb-6">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-3xl font-bold text-stone-800">{pageTitle}</h1>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow p-5 flex flex-col gap-5">

          {/* Dish / item name */}
          <div>
            <label className={labelCls}>
              {itemNoun ?? 'Item'}
            </label>
            <input
              type="text"
              value={dish}
              onChange={e => setDish(e.target.value)}
              placeholder={`Add a ${(itemNoun ?? 'item').toLowerCase()}`}
              autoFocus={!hasName}
              className={inputCls}
            />
            {supportsCategories && (
              <div className="flex flex-wrap gap-2 mt-2.5">
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
            )}
          </div>

          {/* Your name */}
          <div>
            <label className={labelCls}>
              Your Name <span className="text-stone-400 normal-case font-normal tracking-normal">optional</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              autoFocus={hasName}
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>
              Notes <span className="text-stone-400 normal-case font-normal tracking-normal">optional</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything to mention…"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent resize-none bg-white"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

        </div>

        {/* Primary action */}
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          className="mt-4 w-full py-3.5 rounded-xl bg-ember text-white font-semibold text-sm hover:bg-ember-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : isEdit ? 'Update' : name.trim() ? 'Sign Up' : 'Save Item'}
        </button>

        {/* Remove my name (edit mode) */}
        {isEdit && (
          <div className="mt-3">
            {!confirmRemove ? (
              <button
                onClick={() => { setConfirmDelete(false); setConfirmRemove(true) }}
                disabled={saving}
                className="w-full py-3 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                Remove my name
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="text-sm text-red-700 flex-1">Remove your sign-up?</span>
                <button
                  onClick={() => setConfirmRemove(false)}
                  disabled={removing}
                  className="text-sm text-stone-500 hover:text-stone-700 font-medium min-h-[44px] px-3 disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-4 py-2.5 min-h-[44px] rounded-lg transition-colors disabled:opacity-40"
                >
                  {removing ? 'Removing…' : 'Remove'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Delete this item */}
        <div className="mt-3">
          {!confirmDelete ? (
            <button
              onClick={() => { setConfirmRemove(false); setConfirmDelete(true) }}
              disabled={saving || deletingItem}
              className="w-full py-3 rounded-xl border border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-40"
            >
              Delete this {(itemNoun ?? 'item').toLowerCase()}
            </button>
          ) : (
            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <span className="text-sm text-red-700 flex-1">
                Delete this {(itemNoun ?? 'item').toLowerCase()}{signup ? ' and its sign-up' : ''}?
              </span>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deletingItem}
                className="text-sm text-stone-500 hover:text-stone-700 font-medium min-h-[44px] px-3 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteItem}
                disabled={deletingItem}
                className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-4 py-2.5 min-h-[44px] rounded-lg transition-colors disabled:opacity-40"
              >
                {deletingItem ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
