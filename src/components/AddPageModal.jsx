import { useState, useEffect } from 'react'
import { toDateString } from '../utils/dates.js'
import { nextScheduledDate } from '../utils/schedule.js'
import { useModalClose } from '../hooks/useModalClose.js'

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
  const [closing, close] = useModalClose(onClose)
  const defaultDate = findNextAvailableDate(existingDates, targetDow, intervalDays, weekOccurrences)
  const defaultDateStr = toDateString(defaultDate)

  const [title, setTitle]         = useState(defaultTitle(defaultDateStr))
  const [date, setDate]           = useState(defaultDateStr)
  const [slotCount, setSlotCount] = useState(10)
  const [dishes, setDishes]       = useState(Array(10).fill(''))
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [duplicateFrom, setDuplicateFrom] = useState('')
  const [duplicateCategories, setDuplicateCategories] = useState([])

  function handleDuplicateChange(pageId) {
    setDuplicateFrom(pageId)
    if (!pageId) { setDuplicateCategories([]); return }
    const source = pages.find(p => p.id === pageId)
    if (!source) return
    setSlotCount(source.slot_count)
    setDishes(source.slot_dishes?.length ? [...source.slot_dishes] : Array(source.slot_count).fill(''))
    setDuplicateCategories(source.slot_categories?.length ? [...source.slot_categories] : [])
  }

  useEffect(() => {
    setDishes(prev => {
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
        slot_categories: duplicateCategories,
      })
    } catch (err) {
      setError(err.message ?? `Could not create ${pageNoun.toLowerCase()}.`)
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
        <div className="flex items-center justify-between p-6 pb-0 shrink-0">
          <h2 className="text-xl font-bold text-stone-800">Add {pageNoun}</h2>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {pages.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">
                Duplicate from <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <select
                value={duplicateFrom}
                onChange={e => handleDuplicateChange(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent bg-white"
              >
                <option value="">Start from scratch</option>
                {pages.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={handleDateChange}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Number of {noun.toLowerCase()}s
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={30}
                value={slotCount}
                onChange={e => setSlotCount(Number(e.target.value))}
                className="flex-1 accent-jade"
              />
              <span className="w-10 text-center font-semibold text-stone-700">{slotCount}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              {noun}s{' '}
              <span className="text-stone-400 font-normal">(optional — fill in now or later)</span>
            </label>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {dishes.map((dish, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-stone-400 w-20 shrink-0 text-right">{noun} {i + 1}</span>
                  <input
                    type="text"
                    value={dish}
                    onChange={e => setDish(i, e.target.value)}
                    placeholder=""
                    className="flex-1 border border-stone-300 rounded-lg px-3 py-1.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white rounded-lg font-medium disabled:opacity-40 transition-colors"
            >
              {saving ? 'Adding…' : `Add ${pageNoun}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
