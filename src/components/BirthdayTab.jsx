import { useState } from 'react'
import { Cake, ArrowLeft } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { daysUntilNext, formatBirthdayDate } from '../utils/birthdays.js'
import BirthdayCard from './BirthdayCard.jsx'
import { useModalClose } from '../hooks/useModalClose.js'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function daysInMonth(m) { return [0,31,29,31,30,31,30,31,31,30,31,30,31][m] ?? 31 }

function BirthdayModal({ birthday, onClose, onSave, onDelete }) {
  const [closing, close] = useModalClose(onClose)
  const [name, setName]     = useState(birthday?.name ?? '')
  const [month, setMonth]   = useState(birthday?.birthday ? parseInt(birthday.birthday.split('-')[1]) : '')
  const [day, setDay]       = useState(birthday?.birthday ? parseInt(birthday.birthday.split('-')[2]) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!month || !day) { setError('Please select a month and day.'); return }
    setSaving(true)
    setError(null)
    try {
      const dateStr = `2000-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      await onSave({ name: name.trim(), birthday: dateStr })
    } catch (err) {
      setError(err.message ?? 'Could not save.')
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await onDelete()
    } catch (err) {
      setError(err.message ?? 'Could not delete.')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end z-50 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-t-2xl shadow-xl w-full ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-xl font-bold text-stone-800">
            {birthday ? 'Edit Birthday' : 'Add Birthday'}
          </h2>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 space-y-4" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Birthday</label>
            <div className="flex gap-2">
              <select
                value={month}
                onChange={e => { setMonth(Number(e.target.value)); setDay('') }}
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent bg-white"
                required
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                value={day}
                onChange={e => setDay(Number(e.target.value))}
                className="w-24 border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent bg-white"
                required
              >
                <option value="">Day</option>
                {Array.from({ length: month ? daysInMonth(month) : 31 }, (_, i) => (
                  <option key={i} value={i + 1}>{i + 1}</option>
                ))}
              </select>
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
              onClick={close}
              className="flex-1 py-2 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : birthday ? 'Save' : 'Add'}
            </button>
          </div>

          {birthday && (
            !confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
              >
                Remove Birthday
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="text-sm text-red-700 flex-1">Remove this birthday?</span>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="text-sm text-stone-500 hover:text-stone-700 font-medium px-3 py-2.5 min-h-[44px] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-4 py-2.5 min-h-[44px] rounded-lg disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Removing…' : 'Remove'}
                </button>
              </div>
            )
          )}
        </form>
      </div>
    </div>
  )
}

export default function BirthdayTab({ birthdays, onBirthdaysChange, revealKey, onClose }) {
  const [modal, setModal] = useState(null) // null | 'add' | birthday object

  const sorted = [...birthdays].sort((a, b) => daysUntilNext(a.birthday) - daysUntilNext(b.birthday))

  async function handleSave({ name, birthday }) {
    if (modal && modal !== 'add') {
      const { data, error } = await supabase
        .from('birthdays')
        .update({ name, birthday })
        .eq('id', modal.id)
        .select()
        .single()
      if (error) throw new Error(error.message)
      onBirthdaysChange(prev => prev.map(b => b.id === modal.id ? data : b))
    } else {
      const { data, error } = await supabase
        .from('birthdays')
        .insert({ name, birthday })
        .select()
        .single()
      if (error) throw new Error(error.message)
      onBirthdaysChange(prev => [...prev, data])
    }
    setModal(null)
  }

  async function handleDelete() {
    const { error } = await supabase.from('birthdays').delete().eq('id', modal.id)
    if (error) throw new Error(error.message)
    onBirthdaysChange(prev => prev.filter(b => b.id !== modal.id))
    setModal(null)
  }

  return (
    <main className="max-w-3xl mx-auto px-4 pt-8 pb-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Birthdays</h1>
          <p className="text-stone-500 mt-1 text-sm">
            {birthdays.length === 0
              ? 'No birthdays added yet'
              : `${birthdays.length} birthday${birthdays.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors"
            >
              <ArrowLeft size={20} weight="bold" />
            </button>
          )}
          <button
            onClick={() => setModal('add')}
            className="flex items-center gap-1.5 px-4 py-2 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
          >
            + Add Birthday
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="flex justify-center mb-3"><Cake size={48} weight="fill" className="text-stone-300" /></div>
          <p className="text-sm">Add birthdays to get reminded 30 days before</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((b, i) => (
            <BirthdayCard
              key={b.id}
              index={i}
              birthday={b}
              days={daysUntilNext(b.birthday)}
              revealKey={revealKey}
              onClick={() => setModal(b)}
            />
          ))}
        </div>
      )}

      {modal !== null && (
        <BirthdayModal
          birthday={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={modal !== 'add' ? handleDelete : undefined}
        />
      )}
    </main>
  )
}
