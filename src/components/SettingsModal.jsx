import { useState, useEffect } from 'react'
import { GearSix, SignOut, Trash, Crown, X, Bell, BellSlash, PencilSimple, Lock, Eye, EyeSlash, EnvelopeSimple, UserMinus } from '@phosphor-icons/react'
import { useModalClose } from '../hooks/useModalClose.js'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { AVATAR_ICON_LIST, AVATAR_COLOR_OPTIONS, AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function AvatarCircle({ icon, name, userId, colorKey, size = 'md' }) {
  const dim = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-7 h-7' : 'w-10 h-10'
  const iconSize = size === 'lg' ? 28 : size === 'sm' ? 13 : 20
  const textCls = size === 'lg' ? 'text-xl font-bold' : size === 'sm' ? 'text-[11px] font-bold' : 'text-sm font-bold'
  return (
    <div className={`${dim} rounded-full ${avatarColor(userId, colorKey)} flex items-center justify-center shrink-0`}>
      {icon
        ? <AvatarIcon name={icon} size={iconSize} />
        : <span className={`${textCls} text-white`}>{initials(name)}</span>
      }
    </div>
  )
}

export default function SettingsModal({ groupName, displayName, groupId, isAdmin, userId, onClose, onDisplayNameChange, pushSupported, pushSubscribed, pushPermission, pushToggling, onPushToggle }) {
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
  const [avatarIcon, setAvatarIcon] = useState(null)
  const [avatarColorKey, setAvatarColorKey] = useState(null)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [savingColor, setSavingColor] = useState(false)
  const [email, setEmail] = useState('')
  const [nameOpen, setNameOpen] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState(null)
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState(null)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      .select('avatar_icon, avatar_color')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setAvatarIcon(data?.avatar_icon ?? null)
        setAvatarColorKey(data?.avatar_color ?? null)
      })
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? ''))
  }, [userId])

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
        .select('user_id, display_name, role, avatar_icon, avatar_color')
        .eq('community_group_id', groupId)
        .order('display_name')
        .then(({ data }) => setMembers(data ?? []))
    }, 260)
    return () => clearTimeout(id)
  }, [groupId, isAdmin])

  async function handleSelectAvatar(icon) {
    setSavingAvatar(true)
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_icon: icon })
      .eq('user_id', userId)
    if (error) {
      toast('Failed to save avatar', 'error')
    } else {
      setAvatarIcon(icon)
      setAvatarPickerOpen(false)
    }
    setSavingAvatar(false)
  }

  async function handleSelectColor(colorKey) {
    setSavingColor(true)
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_color: colorKey })
      .eq('user_id', userId)
    if (error) {
      toast('Failed to save color', 'error')
    } else {
      setAvatarColorKey(colorKey)
    }
    setSavingColor(false)
  }

  async function handleChangeName(e) {
    e.preventDefault()
    const trimmed = nameValue.trim()
    if (!trimmed) return
    setNameSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: trimmed })
      .eq('user_id', userId)
    if (error) {
      toast('Failed to update name', 'error')
    } else {
      // Keep the local admin members list in sync
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, display_name: trimmed } : m))
      onDisplayNameChange?.(trimmed)
      toast('Name updated', 'success')
      setNameOpen(false)
    }
    setNameSaving(false)
  }

  async function handleLeaveGroup() {
    setLeaving(true)
    setLeaveError(null)
    const { error } = await supabase.rpc('leave_group')
    if (error) {
      setLeaveError(error.message)
      setLeaving(false)
      return
    }
    await supabase.auth.signOut()
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError(null)
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters.'); return }
    if (newPw !== confirmPw) { setPwError('New passwords don\'t match.'); return }
    setPwSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPw,
    })
    if (signInError) {
      setPwError('Current password is incorrect.')
      setPwSaving(false)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) {
      setPwError(error.message)
      setPwSaving(false)
      return
    }
    toast('Password updated', 'success')
    setPwOpen(false)
    setCurrentPw(''); setNewPw(''); setConfirmPw('')
    setPwError(null)
    setPwSaving(false)
  }

  function copyCode() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
      .then(() => {
        setCodeCopied(true)
        setTimeout(() => setCodeCopied(false), 2000)
      })
      .catch(() => toast('Could not copy to clipboard', 'error'))
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
                    <AvatarCircle icon={m.avatar_icon} name={m.display_name} userId={m.user_id} colorKey={m.avatar_color} size="sm" />
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
                        ? 'Chat notifications on'
                        : 'Chat notifications off'
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

            {/* Avatar picker */}
            <div className="flex items-center gap-4 px-1 mb-3">
              <div className="relative shrink-0">
                <AvatarCircle icon={avatarIcon} name={displayName} userId={userId} colorKey={avatarColorKey} size="lg" />
                <button
                  onClick={() => setAvatarPickerOpen(o => !o)}
                  className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-jade text-white flex items-center justify-center shadow-sm"
                >
                  <PencilSimple size={11} weight="bold" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                {displayName && <p className="text-sm font-medium text-stone-700 truncate">{displayName}</p>}
                {email && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <EnvelopeSimple size={11} className="text-stone-400 shrink-0" />
                    <p className="text-xs text-stone-400 truncate">{email}</p>
                  </div>
                )}
                <button
                  onClick={() => setAvatarPickerOpen(o => !o)}
                  className="text-xs text-jade font-medium mt-0.5"
                >
                  {avatarPickerOpen ? 'Close' : 'Change avatar'}
                </button>
              </div>
              <button
                onClick={() => supabase.auth.signOut()}
                className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-red-500 transition-colors shrink-0"
              >
                <SignOut size={15} weight="bold" />
                Sign out
              </button>
            </div>

            {avatarPickerOpen && (
              <div className="mb-3 p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
                <div>
                  <p className="text-xs text-stone-400 font-medium mb-2">Color</p>
                  <div className="flex gap-2">
                    {AVATAR_COLOR_OPTIONS.map(({ key, bgClass, label }) => (
                      <button
                        key={key}
                        onClick={() => handleSelectColor(key)}
                        disabled={savingColor}
                        title={label}
                        className={`w-9 h-9 rounded-full ${bgClass} flex items-center justify-center transition-transform active:scale-95 disabled:opacity-50 ${
                          avatarColorKey === key ? 'ring-2 ring-offset-2 ring-stone-400 scale-110' : ''
                        }`}
                      >
                        {avatarColorKey === key && (
                          <span className="w-2 h-2 rounded-full bg-white/80" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-stone-400 font-medium mb-2">Icon</p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {AVATAR_ICON_LIST.map(({ name, Icon }) => (
                      <button
                        key={name}
                        onClick={() => handleSelectAvatar(name)}
                        disabled={savingAvatar}
                        className={`h-11 rounded-xl flex items-center justify-center transition-colors ${
                          avatarIcon === name
                            ? `${avatarColor(userId, avatarColorKey)} ring-2 ring-offset-1 ring-jade`
                            : 'bg-stone-100 hover:bg-stone-200 active:bg-stone-200'
                        }`}
                      >
                        <Icon
                          size={22}
                          weight="fill"
                          className={avatarIcon === name ? 'text-white' : 'text-stone-500'}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Change display name */}
            {nameOpen ? (
              <form onSubmit={handleChangeName} className="mb-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
                <p className="text-xs font-semibold text-stone-500">Display Name</p>
                <input
                  autoFocus
                  type="text"
                  placeholder="Your name"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  maxLength={40}
                  required
                  className="w-full text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-jade placeholder:text-stone-300"
                />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setNameOpen(false)}
                    className="flex-1 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={nameSaving || !nameValue.trim()}
                    className="flex-1 py-2 text-sm font-medium text-white bg-jade rounded-xl hover:bg-jade-700 transition-colors disabled:opacity-40"
                  >
                    {nameSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => { setNameValue(displayName); setNameOpen(true) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-50 rounded-xl transition-colors mb-1"
              >
                <PencilSimple size={15} weight="bold" className="text-stone-400" />
                Change display name
              </button>
            )}

            {/* Change password */}
            {pwOpen ? (
              <form onSubmit={handleChangePassword} className="mb-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3">
                <p className="text-xs font-semibold text-stone-500">Change Password</p>

                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    placeholder="Current password"
                    value={currentPw}
                    onChange={e => setCurrentPw(e.target.value)}
                    required
                    className="w-full text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-jade placeholder:text-stone-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showCurrentPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    placeholder="New password"
                    value={newPw}
                    onChange={e => setNewPw(e.target.value)}
                    required
                    className="w-full text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-jade placeholder:text-stone-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  >
                    {showNewPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  className="w-full text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-jade placeholder:text-stone-300"
                />

                {pwError && (
                  <p className="text-xs text-red-500 px-1">{pwError}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setPwOpen(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(null) }}
                    className="flex-1 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pwSaving || !currentPw || !newPw || !confirmPw}
                    className="flex-1 py-2 text-sm font-medium text-white bg-jade rounded-xl hover:bg-jade-700 transition-colors disabled:opacity-40"
                  >
                    {pwSaving ? 'Saving…' : 'Update'}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setPwOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-50 rounded-xl transition-colors mb-1"
              >
                <Lock size={15} weight="bold" className="text-stone-400" />
                Change password
              </button>
            )}

            {/* Leave group */}
            {leaveConfirm ? (
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3 mb-1">
                <p className="text-sm font-semibold text-stone-700">Leave this group?</p>
                <p className="text-xs text-stone-500">
                  You'll lose access to all group content. Your account stays active — you'd need a new invite to rejoin.
                </p>
                {leaveError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{leaveError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setLeaveConfirm(false); setLeaveError(null) }}
                    className="flex-1 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleLeaveGroup}
                    disabled={leaving}
                    className="flex-1 py-2 text-sm font-medium text-white bg-stone-700 hover:bg-stone-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {leaving ? 'Leaving…' : 'Leave'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setLeaveConfirm(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-xl transition-colors mb-1"
              >
                <UserMinus size={15} weight="bold" />
                Leave group
              </button>
            )}

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
