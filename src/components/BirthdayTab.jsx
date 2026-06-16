import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { daysUntilNext, formatBirthdayDate } from '../utils/birthdays.js'

function BirthdayModal({ birthday, onClose, onSave, onDelete }) {
  const [name, setName]           = useState(birthday?.name ?? '')
  const [date, setDate]           = useState(birthday?.birthday ?? '')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]   = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave({ name: name.trim(), birthday: date })
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-xl font-bold text-stone-800">
            {birthday ? 'Edit Birthday' : 'Add Birthday'}
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
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
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
              required
            />
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
                  className="text-sm text-stone-500 hover:text-stone-700 font-medium px-2 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-3 py-1 rounded-lg disabled:opacity-50 transition-colors"
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

export default function BirthdayTab({ birthdays, onBirthdaysChange }) {
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
        <button
          onClick={() => setModal('add')}
          className="flex items-center gap-1.5 px-4 py-2 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Add Birthday
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="text-4xl mb-3">🎂</div>
          <p className="text-sm">Add birthdays to get reminded 2 weeks before</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(b => {
            const days = daysUntilNext(b.birthday)
            return (
              <button
                key={b.id}
                onClick={() => setModal(b)}
                className={`w-full text-left p-4 rounded-xl border-2 bg-white shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-jade ${
                  days <= 14
                    ? 'border-lagoon-200 hover:border-lagoon'
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-800">{b.name}</div>
                    <div className="text-sm text-stone-500 mt-0.5">{formatBirthdayDate(b.birthday)}</div>
                  </div>
                  {days === 0 ? (
                    <span className="text-xs font-medium bg-jade text-white px-2.5 py-1 rounded-full shrink-0">
                      Today! 🎉
                    </span>
                  ) : days <= 14 ? (
                    <span className="text-xs font-medium bg-lagoon-100 text-jade px-2.5 py-1 rounded-full shrink-0">
                      in {days} day{days !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-stone-400 shrink-0">
                      in {days} days
                    </span>
                  )}
                </div>
              </button>
            )
          })}
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
