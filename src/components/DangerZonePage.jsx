import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, UserMinus, Trash, Warning } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { useToast } from '../lib/toast.jsx'

export default function DangerZonePage() {
  const navigate = useNavigate()
  const { groupId } = useAppContext()
  const toast = useToast()

  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState(null)

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  async function handleLeaveGroup() {
    setLeaving(true)
    setLeaveError(null)
    const { error } = await supabase.rpc('leave_group')
    if (error) { setLeaveError(error.message); setLeaving(false); return }
    await supabase.auth.signOut()
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.rpc('delete_current_user')
    if (error) { setDeleteError(error.message); setDeleting(false); return }
    await supabase.auth.signOut()
  }

  return (
    <main className="max-w-md mx-auto px-4 pt-8 pb-12">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-1 min-w-0 -ml-2">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-3xl font-bold text-stone-800">Danger Zone</h1>
        </div>
      </div>

      <div className="flex items-start gap-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <Warning size={18} weight="fill" className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 leading-relaxed">
          These actions are permanent and cannot be undone. Please read carefully before proceeding.
        </p>
      </div>

      {/* Leave Group */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Leave Group</p>
        <div className="bg-white border border-stone-100 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
              <UserMinus size={18} weight="fill" className="text-stone-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800">Leave this group</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                You'll lose access to all group content including messages, events, and prayer. Your account stays active — you'd need a new invite to rejoin.
              </p>
            </div>
          </div>

          {leaveError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{leaveError}</p>
          )}

          {leaveConfirm ? (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-stone-700 text-center">Are you sure you want to leave?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setLeaveConfirm(false); setLeaveError(null) }}
                  className="flex-1 py-2.5 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeaveGroup}
                  disabled={leaving}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-stone-700 hover:bg-stone-800 rounded-xl transition-colors disabled:opacity-40"
                >
                  {leaving ? 'Leaving…' : 'Yes, leave'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setLeaveConfirm(true)}
              className="w-full py-2.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
            >
              Leave Group
            </button>
          )}
        </div>
      </div>

      {/* Delete Account */}
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Delete Account</p>
        <div className="bg-white border border-red-100 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <Trash size={18} weight="fill" className="text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-700">Delete my account</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                Permanently deletes your account and all your data — messages, prayer entries, RSVPs, and profile. This cannot be undone.
              </p>
            </div>
          </div>

          {deleteError && (
            <p className="text-xs text-red-700 bg-red-50 rounded-xl px-3 py-2">{deleteError}</p>
          )}

          {deleteConfirm ? (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold text-red-700 text-center">This will permanently delete everything.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteError(null) }}
                  className="flex-1 py-2.5 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Delete Forever'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="w-full py-2.5 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
            >
              Delete Account
            </button>
          )}
        </div>
      </div>

    </main>
  )
}
