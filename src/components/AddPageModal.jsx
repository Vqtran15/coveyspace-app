import { useState, useEffect } from 'react'
import { ArrowLeft } from '@phosphor-icons/react'
import { toDateString } from '../utils/dates.js'
import { nextScheduledDate } from '../utils/schedule.js'

const ANIM_OUT = 200  // matches slide-out-right 0.2s

function findNextAvailableDate(existingDates, targetDow = null, intervalDays = 7, weekOccurrences = null) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const hasDow = targetDow != null && (!Array.isArray(targetDow) || targetDow.length > 0)
  const dowArr = hasDow ? (Array.isArray(targetDow) ? targetDow : [targetDow]) : []

  if (weekOccurrences && weekOccurrences.length > 0 && hasDow) {
    let d = nextScheduledDate(today, targetDow, weekOccurrences)
    while (d && existingDates.includes(toDateString(d))) {
      d = nextScheduledDate(d, targetDow, weekOccurrences)
    }
    return d ?? today
  }

  let d = new Date(today)
  if (hasDow) {
    const diff = dowArr.reduce((best, t) => {
      const gap = d.getDay() === t ? 7 : (t - d.getDay() + 7) % 7
      return gap < best ? gap : best
    }, 7)
    d.setDate(d.getDate() + diff)
  } else {
    d.setDate(d.getDate() + intervalDays)
  }
  while (existingDates.includes(toDateString(d))) {
    d.setDate(d.getDate() + intervalDays)
    if (hasDow) {
      const diff = dowArr.reduce((best, t) => {
        const gap = (t - d.getDay() + 7) % 7
        return gap < best ? gap : best
      }, 7)
      if (diff > 0) d.setDate(d.getDate() + diff)
    }
  }
  return d
}

export default function AddPageModal({ noun, pageNoun, defaultTitle, pages = [], onClose, onSave, existingDates, targetDow = null, intervalDays = 7, weekOccurrences = null }) {
  const [exiting, setExiting] = useState(false)
  const defaultDate = findNextAvailableDate(existingDates, targetDow, intervalDays, weekOccurrences)
  const defaultDateStr = toDateString(defaultDate)

  const [title, setTitle]       = useState(defaultTitle(defaultDateStr))
  const [date, setDate]         = useState(defaultDateStr)
  const [slotCount, setSlotCount] = useState(10)
  const [dishes, setDishes]     = useState(Array(10).fill(''))
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [duplicateFrom, setDuplicateFrom] = useState('')
  const [duplicateCategories, setDuplicateCategories] = useState([])

  function handleClose() {
    setExiting(true)
    setTimeout(onClose, ANIM_OUT)
  }

  function handleDuplicateChange(pageId) {
    setDuplicateFrom(pageId)
    if (!pageId) { setDuplicateCategories([]); return }
    const source = pages.find(p => p.id === pageId)
    if (!source) return
    setSlotCount(source.slot_count)
    setDishes(source.slot_dishes?.length ? [...source.slot_dishes] : Array(source.slot_count).fill(''))
    setDuplicateCategories(source.slot_categories ? [...source.slot_categories] : [])
  }

  useEffect(() => {
    setDishes(prev => {
      const next = Array(slotCount).fill('')
      for (let i = 0; i < Math.min(prev.length, slotCount); i++) next[i] = prev[i]
      return next
    })
    setDuplicateCategories(prev => {
      if (!prev.length) return prev
      const next = Array(slotCount).fill('')
      for (let i = 0; i < Math.min(prev.length, slotCount); i++) next[i] = prev[i]
      return next
    })
  }, [slotCount])

  function handleDateChange(e) {
    setDate(e.target.value)
    setError(null)
  }

  function setDish(index, value) {
    setDishes(prev => { const next = [...prev]; next[index] = value; return next })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (existingDates.includes(date)) {
      setError(`A ${pageNoun.toLowerCase()} already exists for this date. Pick a different date.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        week_date: date,
        slot_count: slotCount,
        slot_dishes: dishes.map(d => d.trim()),
        ...(duplicateCategories.length > 0 && { slot_categories: duplicateCategories }),
      })
      // Animate out on success so the transition matches the back-button path
      setExiting(true)
      setTimeout(onClose, ANIM_OUT)
    } catch (err) {
      setError(err.message ?? `Could not create ${pageNoun.toLowerCase()}.`)
      setSaving(false)
    }
  }

  const inputClass = 'w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent bg-white'
  const labelClass = 'block text-sm font-semibold text-stone-700 mb-1.5'

  return (
    <div
      data-overlay="true"
      className={`fixed inset-0 lg:left-56 z-[55] bg-sunrise-50 flex flex-col ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
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
          <h1 className="flex-1 text-3xl font-bold text-stone-800">Add {pageNoun}</h1>
        </div>
      </div>

      {/* Scrollable form */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="max-w-3xl mx-auto px-4 pb-6 space-y-4">
          {pages.length > 0 && (
            <div>
              <label className={labelClass}>
                Duplicate from <span className="text-stone-400 font-normal">— optional</span>
              </label>
              <select
                value={duplicateFrom}
                onChange={e => handleDuplicateChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Start from scratch</option>
                {pages.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={labelClass}>{pageNoun} title</label>
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
                onChange={handleDateChange}
                style={{ width: '100%', boxSizing: 'border-box', display: 'block' }}
                className="px-4 py-3 text-sm text-stone-800 focus:outline-none bg-white appearance-none"
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Number of {noun.toLowerCase()}s
              <span className="text-stone-400 font-normal ml-1.5 tabular-nums">{slotCount}</span>
            </label>
            <input
              type="range"
              min={1}
              max={30}
              value={slotCount}
              onChange={e => setSlotCount(Number(e.target.value))}
              className="w-full accent-ember"
            />
          </div>

          <div>
            <label className={labelClass}>
              {noun}s <span className="text-stone-400 font-normal">— optional, fill in now or later</span>
            </label>
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm divide-y divide-stone-100">
              {dishes.map((dish, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <span className={`text-xs font-medium shrink-0 text-right tabular-nums whitespace-nowrap ${dish ? 'text-stone-300' : 'text-stone-400'}`}>
                    {noun} {i + 1}
                  </span>
                  <input
                    type="text"
                    value={dish}
                    onChange={e => setDish(i, e.target.value)}
                    placeholder="—"
                    className="flex-1 text-base text-stone-800 placeholder:text-stone-300 bg-transparent focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <div style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 bg-ember hover:bg-ember-700 active:bg-ember-800 text-white font-semibold rounded-2xl transition-colors disabled:opacity-40"
            >
              {saving ? 'Adding…' : `Add ${pageNoun}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
