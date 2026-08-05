import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { GearSix, SignOut, Trash, ShieldCheck, Bell, BellSlash, PencilSimple, Lock, Eye, EyeSlash, EnvelopeSimple, UserMinus, CaretRight, ChatTeardropDots, Heart, ArrowLeft, Cake } from '@phosphor-icons/react'
import { useModalClose } from '../hooks/useModalClose.js'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { AvatarCircle } from '../lib/avatarIcons.jsx'
import FeedbackModal from './FeedbackModal.jsx'
import AvatarPicker from './AvatarPicker.jsx'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function daysInMonth(month) {
  if (!month) return 31
  return new Date(2000, month, 0).getDate()
}

export default function SettingsModal({ displayName, isAdmin, userId, onClose, onDisplayNameChange, onAvatarChange, pushSupported, pushSubscribed, pushPermission, pushToggling, onPushToggle, onRevisitGuide }) {
  const [closing, close] = useModalClose(onClose)
  const navigate = useNavigate()
  const toast = useToast()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const [avatarIcon, setAvatarIcon] = useState(null)
  const [avatarColorKey, setAvatarColorKey] = useState(null)
  const [avatarImageUrl, setAvatarImageUrl] = useState(null)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [nameOpen, setNameOpen] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [legalNameOpen, setLegalNameOpen]     = useState(false)
  const [legalFirst, setLegalFirst]           = useState('') // last-saved value (for display)
  const [legalLast, setLegalLast]             = useState('') // last-saved value (for display)
  const [editFirst, setEditFirst]             = useState('') // live form input
  const [editLast, setEditLast]               = useState('') // live form input
  const [legalNameSaving, setLegalNameSaving] = useState(false)
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
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [bdMonth, setBdMonth] = useState(null)
  const [bdDay, setBdDay] = useState(null)
  const [bdOpen, setBdOpen] = useState(false)
  const [bdSaving, setBdSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      .select('avatar_icon, avatar_color, avatar_image_url, first_name, last_name, birthday')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setAvatarIcon(data?.avatar_icon ?? null)
        setAvatarColorKey(data?.avatar_color ?? null)
        setAvatarImageUrl(data?.avatar_image_url ?? null)
        setLegalFirst(data?.first_name ?? '')
        setLegalLast(data?.last_name  ?? '')
        if (data?.birthday) {
          const [, mm, dd] = data.birthday.split('-')
          setBdMonth(Number(mm))
          setBdDay(Number(dd))
        }
      })
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? ''))
  }, [userId])

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
      onDisplayNameChange?.(trimmed)
      toast('Name updated', 'success')
      setNameOpen(false)
    }
    setNameSaving(false)
  }

  async function handleChangeLegalName(e) {
    e.preventDefault()
    const trimmedFirst = editFirst.trim()
    const trimmedLast  = editLast.trim()
    if (!trimmedFirst) return
    setLegalNameSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ first_name: trimmedFirst, last_name: trimmedLast || null })
      .eq('user_id', userId)
    if (error) {
      toast('Failed to update name', 'error')
    } else {
      setLegalFirst(trimmedFirst)
      setLegalLast(trimmedLast)
      toast('Name updated', 'success')
      setLegalNameOpen(false)
    }
    setLegalNameSaving(false)
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
    if (!user) { setPwError('Session expired. Please log in again.'); setPwSaving(false); return }
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

  async function handleSaveBirthday() {
    if (!bdMonth || !bdDay) return
    setBdSaving(true)
    const mm = String(bdMonth).padStart(2, '0')
    const dd = String(bdDay).padStart(2, '0')
    const { error } = await supabase
      .from('profiles')
      .update({ birthday: `2000-${mm}-${dd}` })
      .eq('user_id', userId)
    if (error) {
      toast('Failed to save birthday', 'error')
    } else {
      toast('Birthday saved', 'success')
      setBdOpen(false)
    }
    setBdSaving(false)
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
    <>
    <div
      className={`fixed inset-0 lg:left-56 z-50 bg-white overflow-y-auto overscroll-contain ${closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
    >
      <div
        className="sticky top-0 bg-white border-b border-stone-100 z-10 shrink-0"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-1 px-4 py-3">
          <button
            onClick={close}
            aria-label="Back"
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-stone-100 text-stone-500 -ml-1.5 shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-lg font-bold text-stone-800">Settings</h1>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 pt-4 pb-12 space-y-2">
          {isAdmin && (
            <div className="pt-2 border-t border-stone-100">
              <button
                onClick={() => { close(); setTimeout(() => navigate('/admin'), 260) }}
                className="w-full flex items-center gap-3 px-4 py-3.5 bg-ember hover:bg-ember-700 active:scale-[0.98] rounded-2xl transition-all"
              >
                <ShieldCheck size={20} weight="fill" className="text-white/80 shrink-0" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white">Admin settings</p>
                  <p className="text-xs text-white/60">Members, features &amp; schedules</p>
                </div>
                <CaretRight size={14} className="text-white/40" />
              </button>
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
                  className="w-full flex items-center gap-3 px-1 py-2.5 text-sm text-stone-700 hover:text-stone-900 transition-colors disabled:opacity-40"
                >
                  {pushSubscribed
                    ? <Bell size={18} weight="fill" className="text-ember shrink-0" />
                    : <BellSlash size={18} weight="fill" className="text-stone-400 shrink-0" />
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
                <AvatarCircle icon={avatarIcon} name={displayName} userId={userId} colorKey={avatarColorKey} size="lg" imageUrl={avatarImageUrl} />
                <button
                  onClick={() => setAvatarPickerOpen(o => !o)}
                  aria-label="Edit avatar"
                  className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-ember text-white flex items-center justify-center shadow-sm"
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
                  className="text-xs text-ember font-medium mt-0.5"
                >
                  {avatarPickerOpen ? 'Close' : 'Edit photo'}
                </button>
              </div>
            </div>

            {avatarPickerOpen && createPortal(
              <AvatarPicker
                userId={userId}
                currentIcon={avatarIcon}
                currentColor={avatarColorKey}
                currentImageUrl={avatarImageUrl}
                onSave={({ icon, color, imageUrl }) => {
                  setAvatarIcon(icon)
                  setAvatarColorKey(color)
                  setAvatarImageUrl(imageUrl)
                  onAvatarChange?.({ icon, color, imageUrl })
                }}
                onClose={() => setAvatarPickerOpen(false)}
              />,
              document.body
            )}

            {/* Change display name */}
            <AnimatePresence initial={false}>
              {nameOpen ? (
                <motion.form
                  key="name-form"
                  onSubmit={handleChangeName}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="mb-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3"
                >
                  <p className="text-xs font-semibold text-stone-500">Display Name</p>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Your name"
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    maxLength={40}
                    required
                    className="w-full text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ember placeholder:text-stone-300"
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
                      className="flex-1 py-2 text-sm font-medium text-white bg-ember rounded-xl hover:bg-ember-700 transition-colors disabled:opacity-40"
                    >
                      {nameSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.button
                  key="name-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  onClick={() => { setNameValue(displayName); setNameOpen(true) }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-50 rounded-xl transition-colors mb-1"
                >
                  <PencilSimple size={15} weight="bold" className="text-stone-400" />
                  Change display name
                </motion.button>
              )}
            </AnimatePresence>

            {/* First & last name */}
            <AnimatePresence initial={false}>
              {legalNameOpen ? (
                <motion.form
                  key="legal-name-form"
                  onSubmit={handleChangeLegalName}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="mb-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3"
                >
                  <p className="text-xs font-semibold text-stone-500">First &amp; Last Name</p>
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="First"
                      value={editFirst}
                      onChange={e => setEditFirst(e.target.value)}
                      maxLength={40}
                      required
                      autoComplete="given-name"
                      className="flex-1 min-w-0 text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ember placeholder:text-stone-300"
                    />
                    <input
                      type="text"
                      placeholder="Last"
                      value={editLast}
                      onChange={e => setEditLast(e.target.value)}
                      maxLength={40}
                      autoComplete="family-name"
                      className="flex-1 min-w-0 text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ember placeholder:text-stone-300"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setLegalNameOpen(false)}
                      className="flex-1 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={legalNameSaving || !editFirst.trim()}
                      className="flex-1 py-2 text-sm font-medium text-white bg-ember rounded-xl hover:bg-ember-700 transition-colors disabled:opacity-40"
                    >
                      {legalNameSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.button
                  key="legal-name-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  onClick={() => { setEditFirst(legalFirst); setEditLast(legalLast); setLegalNameOpen(true) }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-50 rounded-xl transition-colors mb-1"
                >
                  <PencilSimple size={15} weight="bold" className="text-stone-400" />
                  {legalFirst ? `${legalFirst}${legalLast ? ' ' + legalLast : ''}` : 'Add first & last name'}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Birthday */}
            <AnimatePresence initial={false}>
              {bdOpen ? (
                <motion.div
                  key="bd-form"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="mb-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3"
                >
                  <p className="text-xs font-semibold text-stone-500">Birthday</p>
                  <div className="flex gap-2">
                    <select
                      value={bdMonth ?? ''}
                      onChange={e => { setBdMonth(Number(e.target.value) || null); setBdDay(null) }}
                      className="flex-1 min-w-0 text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ember text-stone-800"
                    >
                      <option value="">Month</option>
                      {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <select
                      value={bdDay ?? ''}
                      onChange={e => setBdDay(Number(e.target.value) || null)}
                      className="w-24 shrink-0 text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ember text-stone-800"
                    >
                      <option value="">Day</option>
                      {Array.from({ length: daysInMonth(bdMonth) }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setBdOpen(false)}
                      className="flex-1 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveBirthday}
                      disabled={!bdMonth || !bdDay || bdSaving}
                      className="flex-1 py-2 text-sm font-medium text-white bg-ember rounded-xl hover:bg-ember-700 transition-colors disabled:opacity-40"
                    >
                      {bdSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="bd-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  onClick={() => setBdOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-50 rounded-xl transition-colors mb-1"
                >
                  <Cake size={15} weight="bold" className="text-stone-400" />
                  {bdMonth && bdDay ? `Birthday: ${MONTHS[bdMonth - 1]} ${bdDay}` : 'Add birthday'}
                </motion.button>
              )}
            </AnimatePresence>

            {/* Change password */}
            <AnimatePresence initial={false}>
              {pwOpen ? (
                <motion.form
                  key="pw-form"
                  onSubmit={handleChangePassword}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="mb-3 p-4 bg-stone-50 rounded-2xl border border-stone-100 space-y-3"
                >
                  <p className="text-xs font-semibold text-stone-500">Change Password</p>

                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      placeholder="Current password"
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      required
                      className="w-full text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-ember placeholder:text-stone-300"
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
                      className="w-full text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:ring-2 focus:ring-ember placeholder:text-stone-300"
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
                    className="w-full text-sm bg-white border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ember placeholder:text-stone-300"
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
                      className="flex-1 py-2 text-sm font-medium text-white bg-ember rounded-xl hover:bg-ember-700 transition-colors disabled:opacity-40"
                    >
                      {pwSaving ? 'Saving…' : 'Update'}
                    </button>
                  </div>
                </motion.form>
              ) : (
                <motion.button
                  key="pw-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  onClick={() => setPwOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-50 rounded-xl transition-colors mb-1"
                >
                  <Lock size={15} weight="bold" className="text-stone-400" />
                  Change password
                </motion.button>
              )}
            </AnimatePresence>

            {onRevisitGuide && (
              <button
                onClick={onRevisitGuide}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-50 rounded-xl transition-colors mb-1"
              >
                <GearSix size={15} weight="bold" className="text-stone-400" />
                View setup guide
              </button>
            )}
            <button
              onClick={() => setFeedbackOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-ember hover:text-ember-700 hover:bg-ember/5 rounded-xl transition-colors mb-1"
            >
              <ChatTeardropDots size={15} weight="fill" className="text-ember shrink-0" />
              Send Feedback
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-50 rounded-xl transition-colors mb-1"
            >
              <SignOut size={15} weight="bold" className="text-stone-400" />
              Sign out
            </button>

            <div className="rounded-2xl bg-coral/5 border border-coral/20 p-4 mb-1">
              <div className="flex items-center gap-2 mb-2">
                <Heart size={15} weight="fill" className="text-coral shrink-0" />
                <p className="text-sm font-semibold text-stone-700">Support Covey Space</p>
              </div>
              <p className="text-xs text-stone-500 leading-relaxed mb-3">
                Covey Space is community-funded. Your support helps cover the costs that keep this app running — data storage, web hosting/development, and email services.
              </p>
              <a
                href="https://ko-fi.com/coveyspace"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-coral text-white text-sm font-semibold rounded-xl hover:bg-coral-600 active:scale-[0.98] transition-all"
              >
                <Heart size={14} weight="fill" />
                Support Covey Space
              </a>
            </div>

            {/* Leave group */}
            <AnimatePresence initial={false}>
              {leaveConfirm ? (
                <motion.div
                  key="leave-confirm"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3 mb-1"
                >
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
                      className="flex-1 py-2 text-sm font-medium text-white bg-stone-700 hover:bg-stone-800 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {leaving ? 'Leaving…' : 'Leave'}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="leave-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  onClick={() => setLeaveConfirm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-stone-400 hover:text-stone-600 hover:bg-stone-50 rounded-xl transition-colors mb-1"
                >
                  <UserMinus size={15} weight="bold" />
                  Leave group
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence initial={false}>
              {showDeleteConfirm ? (
                <motion.div
                  key="delete-confirm"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                  className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3"
                >
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
                      className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-40"
                    >
                      {deleting ? 'Deleting…' : 'Delete Forever'}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="delete-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <Trash size={15} weight="bold" />
                  Delete my account
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
    </div>

    {feedbackOpen && (
      <FeedbackModal
        userId={userId}
        displayName={displayName}
        email={email}
        onClose={() => setFeedbackOpen(false)}
      />
    )}
  </>
  )
}
