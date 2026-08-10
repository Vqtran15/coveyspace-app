import { useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Cake, ArrowLeft, X } from '@phosphor-icons/react'
import { daysUntilNext, formatBirthdayDate } from '../utils/birthdays.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import BirthdayCard from './BirthdayCard.jsx'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function daysInMonth(month) {
  if (!month) return 31
  return new Date(2000, month, 0).getDate()
}

const inputCls = 'flex-1 min-w-0 text-sm bg-white border border-stone-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-ember text-stone-800'

export default function BirthdayTab({ birthdays, revealKey, onClose }) {
  const { userId, isAdmin } = useAppContext()
  const toast = useToast()

  const sorted = [...birthdays].sort((a, b) => daysUntilNext(a.birthday) - daysUntilNext(b.birthday))

  // Selected birthday drives action sheet
  const [selected, setSelected] = useState(null)
  // Edit sheet
  const [editOpen, setEditOpen] = useState(false)
  const [editMonth, setEditMonth] = useState(null)
  const [editDay, setEditDay] = useState(null)
  const [saving, setSaving] = useState(false)
  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const canManage = (b) => isAdmin || b.profile_user_id === userId

  function openAction(b) {
    if (!canManage(b)) return
    setSelected(b)
  }

  function closeAction() {
    setSelected(null)
    setEditOpen(false)
    setDeleteOpen(false)
  }

  function openEdit() {
    if (!selected) return
    const [, mm, dd] = selected.birthday.split('-')
    setEditMonth(Number(mm))
    setEditDay(Number(dd))
    setEditOpen(true)
  }

  async function handleSaveEdit() {
    if (!editMonth || !editDay) return
    setSaving(true)
    const mm = String(editMonth).padStart(2, '0')
    const dd = String(editDay).padStart(2, '0')
    const dateVal = `2000-${mm}-${dd}`

    let error
    if (selected.profile_user_id === userId) {
      // Own birthday: update profiles.birthday → DB trigger syncs to birthdays
      ;({ error } = await supabase
        .from('profiles')
        .update({ birthday: dateVal })
        .eq('user_id', userId))
    } else {
      // Admin editing someone else's birthday: update birthdays directly
      // (profiles RLS only allows self-update, so we can't touch their profile)
      ;({ error } = await supabase
        .from('birthdays')
        .update({ birthday: dateVal })
        .eq('id', selected.id))
    }

    if (error) {
      toast('Failed to save birthday', 'error')
    } else {
      toast('Birthday updated', 'success')
      closeAction()
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!selected) return
    setDeleting(true)
    let error

    if (selected.profile_user_id === userId) {
      // Own birthday: null profiles.birthday so the trigger doesn't re-create the row
      ;({ error } = await supabase
        .from('profiles')
        .update({ birthday: null })
        .eq('user_id', userId))
      if (!error) {
        await supabase.from('birthdays').delete().eq('id', selected.id)
      }
    } else {
      // Admin deleting someone else's birthday: delete the row only
      ;({ error } = await supabase.from('birthdays').delete().eq('id', selected.id))
    }

    if (error) {
      toast('Failed to delete birthday', 'error')
    } else {
      toast('Birthday removed', 'success')
      closeAction()
    }
    setDeleting(false)
  }

  return (
    <>
    <div
      className="h-full overflow-y-auto"
      style={{ overscrollBehaviorY: 'none', paddingTop: 'var(--sat)', overflow: selected ? 'hidden' : undefined }}
    >
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-32 lg:pb-12">
        <div className="mb-6">
          <div className="flex items-center gap-1 min-w-0">
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Back"
                className="w-11 h-11 flex items-center justify-center -ml-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
              >
                <ArrowLeft size={20} weight="bold" />
              </button>
            )}
            <h1 className="text-3xl font-bold text-stone-800">Birthdays</h1>
          </div>
          <p className="text-stone-500 mt-1 text-sm">
            {birthdays.length === 0
              ? 'No birthdays yet'
              : `${birthdays.length} birthday${birthdays.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex justify-center mb-3"><Cake size={40} weight="fill" className="text-stone-300" /></div>
            <p className="text-sm text-stone-500">Birthdays appear here once members add them to their profile.</p>
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
                canEdit={canManage(b)}
                onClick={() => openAction(b)}
              />
            ))}
          </div>
        )}
      </main>
    </div>

    {/* Portal to document.body so position:fixed works correctly regardless of any
        CSS transform applied to ancestor elements (Framer Motion slide-in animation). */}
    {createPortal(
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              key="birthday-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={closeAction}
            />

            {/* Sheet */}
            <motion.div
              key="birthday-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl shadow-xl"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
            >
              {!editOpen && !deleteOpen && (
                <div className="px-4 pt-4 pb-2">
                  {/* Handle */}
                  <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
                  <p className="text-base font-semibold text-stone-800 mb-1">{selected.name}</p>
                  <p className="text-sm text-stone-500 mb-4">{formatBirthdayDate(selected.birthday)}</p>
                  <div className="space-y-2">
                    <button
                      onClick={openEdit}
                      className="w-full py-3 rounded-xl bg-stone-50 border border-stone-100 text-sm font-medium text-stone-700 hover:bg-stone-100 transition-colors"
                    >
                      Edit birthday
                    </button>
                    <button
                      onClick={() => setDeleteOpen(true)}
                      className="w-full py-3 rounded-xl bg-red-50 border border-red-100 text-sm font-medium text-red-500 hover:bg-red-100 transition-colors"
                    >
                      Remove birthday
                    </button>
                    <button
                      onClick={closeAction}
                      className="w-full py-3 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {editOpen && (
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-base font-semibold text-stone-800">Edit birthday</p>
                    <button onClick={closeAction} aria-label="Close" className="w-10 h-10 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100">
                      <X size={20} />
                    </button>
                  </div>

                  <label className="block text-xs font-medium text-stone-500 mb-1.5">Date</label>
                  <div className="flex gap-2 mb-4">
                    <select
                      value={editMonth ?? ''}
                      onChange={e => { setEditMonth(Number(e.target.value) || null); setEditDay(null) }}
                      className={inputCls}
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <select
                      value={editDay ?? ''}
                      onChange={e => setEditDay(Number(e.target.value) || null)}
                      className="w-24 shrink-0 text-sm bg-white border border-stone-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-ember text-stone-800"
                    >
                      <option value="">Day</option>
                      {Array.from({ length: daysInMonth(editMonth) }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={closeAction} className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-500 hover:border-stone-300 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editMonth || !editDay || saving}
                      className="flex-1 py-3 rounded-xl bg-ember text-white text-sm font-medium disabled:opacity-40 hover:bg-ember-700 transition-colors"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {deleteOpen && (
                <div className="px-4 pt-4 pb-2">
                  <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
                  <p className="text-base font-semibold text-stone-800 mb-1">Remove birthday?</p>
                  <p className="text-sm text-stone-500 mb-5">
                    {selected.name}'s birthday will be removed from the list.
                    {selected.profile_user_id === userId ? ' Your profile birthday will also be cleared.' : ''}
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setDeleteOpen(false)} className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-medium text-stone-500 hover:border-stone-300 transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-40 hover:bg-red-600 transition-colors"
                    >
                      {deleting ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    , document.body)}
    </>
  )
}

