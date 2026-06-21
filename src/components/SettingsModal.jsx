import { useState, useEffect } from 'react'
import { GearSix, ListBullets, PencilSimple, SignOut, Trash } from '@phosphor-icons/react'
import { useModalClose } from '../hooks/useModalClose.js'
import { supabase } from '../lib/supabase.js'

export default function SettingsModal({ editLabel, pageNoun, pageNounPlural, groupName, displayName, groupId, isAdmin, onEditPage, onManagePages, onClose }) {
  const [closing, close] = useModalClose(onClose)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [inviteCode, setInviteCode] = useState(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeRotating, setCodeRotating] = useState(false)

  useEffect(() => {
    if (!groupId) return
    supabase
      .from('community_groups')
      .select('invite_code')
      .eq('id', groupId)
      .single()
      .then(({ data }) => setInviteCode(data?.invite_code ?? null))
  }, [groupId])

  function copyCode() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  async function handleRotate() {
    if (!window.confirm('Generate a new invite code? The old code will stop working immediately.')) return
    setCodeRotating(true)
    const { data, error } = await supabase.rpc('rotate_invite_code')
    if (!error) setInviteCode(data)
    setCodeRotating(false)
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await supabase.rpc('delete_current_user')
    if (error) {
      setDeleteError(error.message)
      setDeleting(false)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-4">
          <div className="flex items-center gap-2">
            <GearSix size={20} weight="fill" className="text-jade" />
            <h2 className="text-lg font-bold text-stone-800">Settings</h2>
          </div>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        <div className="px-5 pb-6 space-y-2">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide pb-1">
            {pageNounPlural}
          </p>
          {onEditPage && (
            <button
              onClick={onEditPage}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 border-stone-200 bg-white hover:border-coral hover:bg-coral-light transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-coral-100 flex items-center justify-center">
                  <PencilSimple size={16} weight="bold" className="text-coral-700" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-stone-800">{editLabel}</div>
                  <div className="text-xs text-stone-400 mt-0.5">Edit title, date, and ingredients</div>
                </div>
              </div>
            </button>
          )}
          <button
            onClick={onManagePages}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 border-stone-200 bg-white hover:border-jade hover:bg-lagoon-50 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-lagoon-50 flex items-center justify-center">
                <ListBullets size={16} weight="bold" className="text-lagoon-700" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-stone-800">Manage {pageNounPlural.toLowerCase()}</div>
                <div className="text-xs text-stone-400 mt-0.5">Add, view, and reorder {pageNounPlural.toLowerCase()}</div>
              </div>
            </div>
          </button>

          {inviteCode && (
            <div className="pt-2 border-t border-stone-100">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2">Invite Code</p>
              <div className="flex items-center gap-3 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3">
                <span className="font-mono font-bold text-xl tracking-widest text-stone-800 flex-1">
                  {codeRotating ? '……' : inviteCode}
                </span>
                <button onClick={copyCode} className="text-xs font-semibold text-jade shrink-0">
                  {codeCopied ? 'Copied!' : 'Copy'}
                </button>
                {isAdmin && (
                  <button
                    onClick={handleRotate}
                    disabled={codeRotating}
                    className="text-xs font-semibold text-stone-400 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40"
                  >
                    Rotate
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-1.5">Share this code with people you want to invite.</p>
            </div>
          )}

          <div className="pt-2 border-t border-stone-100">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2">
              Account
            </p>
            <div className="flex items-center justify-between px-1 mb-3">
              <div className="min-w-0 mr-3">
                {displayName && <p className="text-sm font-medium text-stone-700 truncate">{displayName}</p>}
                {groupName && <p className="text-xs text-stone-400 truncate">{groupName}</p>}
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-red-500 transition-colors shrink-0"
              >
                <SignOut size={15} weight="bold" />
                Sign out
              </button>
            </div>

            {showDeleteConfirm ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-red-700">Delete your account?</p>
                <p className="text-xs text-red-600">
                  This permanently deletes your account and all your data. This cannot be undone.
                </p>
                {deleteError && (
                  <p className="text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2">{deleteError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                    className="flex-1 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Delete Forever'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              >
                <Trash size={15} weight="bold" />
                Delete my account
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
