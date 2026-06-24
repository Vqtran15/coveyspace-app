import { useState, useEffect } from 'react'
import { GearSix, SignOut, Trash, Crown, X, Bell, BellSlash } from '@phosphor-icons/react'
import { useModalClose } from '../hooks/useModalClose.js'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function SettingsModal({ groupName, displayName, groupId, isAdmin, userId, onClose, pushSupported, pushSubscribed, pushPermission, pushToggling, onPushToggle }) {
  const [closing, close] = useModalClose(onClose)
  const toast = useToast()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [inviteCode, setInviteCode] = useState(null)
  const [codeCopied, setCodeCopied] = useState(false)
  const [codeRotating, setCodeRotating] = useState(false)
  const [members, setMembers] = useState([])
  const [settingRoleId, setSettingRoleId] = useState(null)
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    if (!groupId || !isAdmin) return
    const id = setTimeout(() => {
      supabase
        .rpc('get_invite_code')
        .then(({ data }) => setInviteCode(data ?? null))
    }, 260)
    return () => clearTimeout(id)
  }, [groupId, isAdmin])

  useEffect(() => {
    if (!groupId || !isAdmin) return
    const id = setTimeout(() => {
      supabase
        .from('profiles')
        .select('user_id, display_name, role')
        .eq('community_group_id', groupId)
        .order('display_name')
        .then(({ data }) => setMembers(data ?? []))
    }, 260)
    return () => clearTimeout(id)
  }, [groupId, isAdmin])

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

  async function handleSetRole(targetId, newRole) {
    setSettingRoleId(targetId)
    const { error } = await supabase.rpc('set_member_role', { target_user_id: targetId, new_role: newRole })
    if (error) toast(error.message, 'error')
    else setMembers(prev => prev.map(m => m.user_id === targetId ? { ...m, role: newRole } : m))
    setSettingRoleId(null)
  }

  async function handleRemoveMember(targetId) {
    const member = members.find(m => m.user_id === targetId)
    if (!window.confirm(`Remove ${member?.display_name ?? 'this member'} from the group?`)) return
    setRemovingId(targetId)
    const { error } = await supabase.rpc('remove_member', { target_user_id: targetId })
    if (!error) setMembers(prev => prev.filter(m => m.user_id !== targetId))
    setRemovingId(null)
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
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-4 shrink-0">
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

        <div className="px-5 pb-6 space-y-2 overflow-y-auto overscroll-contain">
          {isAdmin && inviteCode && (
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

          {isAdmin && members.length > 0 && (
            <div className="pt-2 border-t border-stone-100">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2">Members</p>
              <div className="space-y-0.5">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-2.5 py-1.5">
                    <div className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-bold text-stone-500">{initials(m.display_name)}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <span className="text-sm text-stone-700 truncate">{m.display_name}</span>
                      {m.role === 'admin' && <Crown size={11} weight="fill" className="text-jade shrink-0" />}
                      {m.user_id === userId && <span className="text-stone-400 text-xs shrink-0">(You)</span>}
                    </div>
                    {m.user_id !== userId && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => handleSetRole(m.user_id, m.role === 'admin' ? 'member' : 'admin')}
                          disabled={!!settingRoleId}
                          title={m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                          className="w-7 h-7 flex items-center justify-center text-stone-300 hover:text-jade transition-colors disabled:opacity-40 rounded-lg hover:bg-stone-50"
                        >
                          {settingRoleId === m.user_id
                            ? <span className="text-[10px] text-stone-300">…</span>
                            : <Crown size={13} weight={m.role === 'admin' ? 'fill' : 'regular'} />
                          }
                        </button>
                        <button
                          onClick={() => handleRemoveMember(m.user_id)}
                          disabled={removingId === m.user_id}
                          className="w-7 h-7 flex items-center justify-center text-stone-300 hover:text-red-400 transition-colors disabled:opacity-40 rounded-lg hover:bg-red-50"
                        >
                          {removingId === m.user_id
                            ? <span className="text-[10px] text-stone-300">…</span>
                            : <X size={13} weight="bold" />
                          }
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pushSupported && (
            <div className="pt-2 border-t border-stone-100">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide pb-2">Notifications</p>
              {pushPermission === 'denied' ? (
                <p className="text-xs text-stone-400 px-1 py-1">
                  Notifications are blocked. Enable them in your browser settings.
                </p>
              ) : (
                <button
                  onClick={onPushToggle}
                  disabled={pushToggling}
                  className="w-full flex items-center gap-3 px-1 py-2.5 text-sm text-stone-700 hover:text-stone-900 transition-colors disabled:opacity-50"
                >
                  {pushSubscribed
                    ? <BellSlash size={18} weight="fill" className="text-stone-400 shrink-0" />
                    : <Bell size={18} weight="fill" className="text-jade shrink-0" />
                  }
                  <span className="flex-1 text-left font-medium">
                    {pushToggling
                      ? 'Updating…'
                      : pushSubscribed
                        ? 'Turn off chat notifications'
                        : 'Turn on chat notifications'
                    }
                  </span>
                </button>
              )}
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
