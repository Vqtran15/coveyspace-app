import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useMotionValue, animate as fmAnimate } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { GearSix, SignOut, Trash, ShieldCheck, Bell, BellSlash, PencilSimple, Lock, Eye, EyeSlash, EnvelopeSimple, UserMinus, CaretRight, ChatTeardropDots, Heart, ArrowLeft, Cake } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { AvatarCircle } from '../lib/avatarIcons.jsx'
import FeedbackModal from './FeedbackModal.jsx'
import AvatarPicker from './AvatarPicker.jsx'
import InstallBanner from './InstallBanner.jsx'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
function daysInMonth(month) {
  if (!month) return 31
  return new Date(2000, month, 0).getDate()
}

// Floating label input — label shrinks + rises when focused or filled
function FloatingInput({ label, value, onChange, type = 'text', required, maxLength, autoComplete, className: extra = '', ...props }) {
  const [focused, setFocused] = useState(false)
  const active = focused || (value != null && value !== '')
  return (
    <div className={`relative ${extra}`}>
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        className={`w-full pt-5 pb-2 px-3 rounded-xl border text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent transition-colors ${active ? 'border-ember/50' : 'border-stone-200'}`}
        {...props}
      />
      <label
        className={`absolute left-3 pointer-events-none select-none transition-all duration-200 origin-left ${
          active ? 'top-1.5 text-[10px] font-semibold text-ember' : 'top-3.5 text-sm text-stone-400'
        }`}
      >
        {label}
      </label>
    </div>
  )
}

// Floating label input with password visibility toggle
function FloatingPasswordInput({ label, value, onChange, show, onToggle, required }) {
  const [focused, setFocused] = useState(false)
  const active = focused || (value != null && value !== '')
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        className={`w-full pt-5 pb-2 px-3 pr-10 rounded-xl border text-sm text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent transition-colors ${active ? 'border-ember/50' : 'border-stone-200'}`}
      />
      <label
        className={`absolute left-3 pointer-events-none select-none transition-all duration-200 origin-left ${
          active ? 'top-1.5 text-[10px] font-semibold text-ember' : 'top-3.5 text-sm text-stone-400'
        }`}
      >
        {label}
      </label>
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
        >
          {show ? <EyeSlash size={16} /> : <Eye size={16} />}
        </button>
      )}
    </div>
  )
}

// Hook: drag handle → swipe-down-to-dismiss using a motion value so the DOM
// updates bypass React state (no re-renders per touchmove = butter smooth).
function useSheetDrag(onClose) {
  const y         = useMotionValue(0)
  const startY    = useRef(0)
  const startTime = useRef(0)

  const onTouchStart = useCallback(e => {
    startY.current    = e.touches[0].clientY
    startTime.current = Date.now()
    y.stop()
  }, [y])

  const onTouchMove = useCallback(e => {
    const dy = e.touches[0].clientY - startY.current
    // Positive = downward drag; resist upward with 8% elasticity
    y.set(dy > 0 ? dy : dy * 0.08)
  }, [y])

  const onTouchEnd = useCallback(() => {
    const currentY = y.get()
    const elapsed  = Math.max(Date.now() - startTime.current, 1)
    const velocity = currentY / elapsed
    if (currentY > 80 || velocity > 0.45) {
      // Threshold exceeded — let AnimatePresence exit animation take over
      onClose()
    } else {
      // Snap back with spring
      fmAnimate(y, 0, { type: 'spring', stiffness: 400, damping: 35 })
    }
  }, [y, onClose])

  return {
    dragHandleProps: { onTouchStart, onTouchMove, onTouchEnd },
    dragY: y,
  }
}

export default function SettingsModal({ displayName, isAdmin, userId, onClose, onDisplayNameChange, onAvatarChange, pushSupported, pushSubscribed, pushPermission, pushToggling, onPushToggle, onRevisitGuide }) {
  const navigate = useNavigate()
  const toast = useToast()

  // Sheet state — one sheet open at a time
  const [openSheet, setOpenSheet] = useState(null) // 'name' | 'legal' | 'birthday' | 'password'

  // Avatar
  const [avatarIcon, setAvatarIcon] = useState(null)
  const [avatarColorKey, setAvatarColorKey] = useState(null)
  const [avatarImageUrl, setAvatarImageUrl] = useState(null)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [email, setEmail] = useState('')

  // Display name form
  const [nameValue, setNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)

  // First & last name form
  const [legalFirst, setLegalFirst] = useState('')
  const [legalLast, setLegalLast] = useState('')
  const [editFirst, setEditFirst] = useState('')
  const [editLast, setEditLast] = useState('')
  const [legalNameSaving, setLegalNameSaving] = useState(false)

  // Birthday
  const [bdMonth, setBdMonth] = useState(null)
  const [bdDay, setBdDay] = useState(null)
  const [bdSaving, setBdSaving] = useState(false)

  // Password form
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState(null)

  // Danger zone
  const [leaveConfirm, setLeaveConfirm] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const [feedbackOpen, setFeedbackOpen] = useState(false)

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
        setLegalLast(data?.last_name ?? '')
        if (data?.birthday) {
          const [, mm, dd] = data.birthday.split('-')
          setBdMonth(Number(mm))
          setBdDay(Number(dd))
        }
      })
    supabase.auth.getUser().then(({ data: { user } }) => setEmail(user?.email ?? ''))
  }, [userId])

  function openSettingsSheet(name) {
    setOpenSheet(name)
  }

  function closeSettingsSheet() {
    if (openSheet === 'password') {
      setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(null)
    }
    setOpenSheet(null)
  }

  const { dragHandleProps, dragY } = useSheetDrag(closeSettingsSheet)

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
      closeSettingsSheet()
    }
    setNameSaving(false)
  }

  async function handleChangeLegalName(e) {
    e.preventDefault()
    const trimmedFirst = editFirst.trim()
    const trimmedLast = editLast.trim()
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
      closeSettingsSheet()
    }
    setLegalNameSaving(false)
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
      closeSettingsSheet()
    }
    setBdSaving(false)
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPwError(null)
    if (newPw.length < 6) { setPwError('New password must be at least 6 characters.'); return }
    if (newPw !== confirmPw) { setPwError("New passwords don't match."); return }
    setPwSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPwError('Session expired. Please log in again.'); setPwSaving(false); return }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPw })
    if (signInError) { setPwError('Current password is incorrect.'); setPwSaving(false); return }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    if (error) { setPwError(error.message); setPwSaving(false); return }
    toast('Password updated', 'success')
    closeSettingsSheet()
    setPwSaving(false)
  }

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

  const cancelCls = 'flex-1 py-3 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors'
  const saveCls = 'flex-1 py-3 text-sm font-medium text-white bg-ember rounded-xl hover:bg-ember-700 transition-colors disabled:opacity-40'

  return (
    <>
    <main className="max-w-md mx-auto px-4 pt-8 pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-1 min-w-0 -ml-2">
            <button
              onClick={onClose}
              aria-label="Back"
              className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
            >
              <ArrowLeft size={20} weight="bold" />
            </button>
            <h1 className="text-3xl font-bold text-stone-800">Settings</h1>
          </div>
        </div>

        <InstallBanner />

        {/* Admin */}
        {isAdmin && (
          <div className="mb-4">
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-ember hover:bg-ember-700 active:scale-[0.98] rounded-2xl transition-all"
            >
              <ShieldCheck size={20} weight="fill" className="text-white/80 shrink-0" />
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white">Admin settings</p>
                <p className="text-xs text-white/70">Members, features &amp; schedules</p>
              </div>
              <CaretRight size={14} className="text-white/40" />
            </button>
          </div>
        )}

        {/* Notifications */}
        {pushSupported && (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Notifications</p>
            <div className="bg-white border border-stone-100 rounded-2xl shadow-sm px-4">
              {pushPermission === 'denied' ? (
                <p className="text-xs text-stone-500 py-3.5">
                  Notifications are blocked. Enable them in your browser settings.
                </p>
              ) : (
                <button
                  onClick={onPushToggle}
                  disabled={pushToggling}
                  className="w-full flex items-center gap-3 py-3.5 text-sm text-stone-700 hover:text-stone-900 transition-colors disabled:opacity-40"
                >
                  {pushSubscribed
                    ? <Bell size={18} weight="fill" className="text-ember shrink-0" />
                    : <BellSlash size={18} weight="fill" className="text-stone-400 shrink-0" />
                  }
                  <span className="flex-1 text-left font-medium">
                    {pushToggling ? 'Updating…' : pushSubscribed ? 'Chat notifications on' : 'Chat notifications off'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Profile */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Profile</p>
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">

            {/* Avatar */}
            <div className="flex items-center gap-4 px-4 py-4 border-b border-stone-100">
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

            <button
              onClick={() => { setNameValue(displayName); openSettingsSheet('name') }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors border-b border-stone-100"
            >
              <PencilSimple size={16} weight="bold" className="text-stone-400 shrink-0" />
              <span className="flex-1 text-left">Change display name</span>
              <CaretRight size={14} className="text-stone-300 shrink-0" />
            </button>

            <button
              onClick={() => { setEditFirst(legalFirst); setEditLast(legalLast); openSettingsSheet('legal') }}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors border-b border-stone-100"
            >
              <PencilSimple size={16} weight="bold" className="text-stone-400 shrink-0" />
              <span className="flex-1 text-left">
                {legalFirst ? `${legalFirst}${legalLast ? ' ' + legalLast : ''}` : 'Add first & last name'}
              </span>
              <CaretRight size={14} className="text-stone-300 shrink-0" />
            </button>

            <button
              onClick={() => openSettingsSheet('birthday')}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <Cake size={16} weight="bold" className="text-stone-400 shrink-0" />
              <span className="flex-1 text-left">
                {bdMonth && bdDay ? `Birthday: ${MONTHS[bdMonth - 1]} ${bdDay}` : 'Add birthday'}
              </span>
              <CaretRight size={14} className="text-stone-300 shrink-0" />
            </button>
          </div>
        </div>

        {/* Account */}
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Account</p>
          <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => openSettingsSheet('password')}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors border-b border-stone-100"
            >
              <Lock size={16} weight="bold" className="text-stone-400 shrink-0" />
              <span className="flex-1 text-left">Change password</span>
              <CaretRight size={14} className="text-stone-300 shrink-0" />
            </button>

            {onRevisitGuide && (
              <button
                onClick={onRevisitGuide}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors border-b border-stone-100"
              >
                <GearSix size={16} weight="bold" className="text-stone-400 shrink-0" />
                <span className="flex-1 text-left">View setup guide</span>
                <CaretRight size={14} className="text-stone-300 shrink-0" />
              </button>
            )}

            <button
              onClick={() => setFeedbackOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-ember hover:bg-ember/5 transition-colors border-b border-stone-100"
            >
              <ChatTeardropDots size={16} weight="fill" className="text-ember shrink-0" />
              <span className="flex-1 text-left">Send feedback</span>
              <CaretRight size={14} className="text-ember/40 shrink-0" />
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-stone-500 hover:bg-stone-50 transition-colors"
            >
              <SignOut size={16} weight="bold" className="text-stone-400 shrink-0" />
              <span className="flex-1 text-left">Sign out</span>
            </button>
          </div>
        </div>

        {/* Support */}
        <div className="rounded-2xl bg-coral/5 border border-coral/20 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Heart size={15} weight="fill" className="text-coral shrink-0" />
            <p className="text-sm font-semibold text-stone-700">Support Coveyspace</p>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed mb-3">
            Coveyspace is community-funded. Your support helps cover the costs that keep this app running — data storage, web hosting/development, and email services.
          </p>
          <a
            href="https://ko-fi.com/coveyspace"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-coral text-white text-sm font-semibold rounded-xl hover:bg-coral-600 active:scale-[0.98] transition-all"
          >
            <Heart size={14} weight="fill" />
            Support Coveyspace
          </a>
        </div>

        {/* Danger zone */}
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {leaveConfirm ? (
              <motion.div
                key="leave-confirm"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3"
              >
                <p className="text-sm font-semibold text-stone-700">Leave this group?</p>
                <p className="text-xs text-stone-500">
                  You'll lose access to all group content. Your account stays active — you'd need a new invite to rejoin.
                </p>
                {leaveError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{leaveError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setLeaveConfirm(false); setLeaveError(null) }} className="flex-1 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">Cancel</button>
                  <button onClick={handleLeaveGroup} disabled={leaving} className="flex-1 py-2 text-sm font-medium text-white bg-stone-700 hover:bg-stone-800 rounded-xl transition-colors disabled:opacity-40">{leaving ? 'Leaving…' : 'Leave'}</button>
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
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-stone-400 hover:text-stone-600 hover:bg-stone-50 bg-white border border-stone-100 rounded-2xl transition-colors"
              >
                <UserMinus size={15} weight="bold" />
                <span>Leave group</span>
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
                className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-3"
              >
                <p className="text-sm font-semibold text-red-700">Delete your account?</p>
                <p className="text-xs text-red-600">This permanently deletes your account and all your data. This cannot be undone.</p>
                {deleteError && <p className="text-xs text-red-700 bg-red-100 rounded-lg px-3 py-2">{deleteError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }} className="flex-1 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors">Cancel</button>
                  <button onClick={handleDeleteAccount} disabled={deleting} className="flex-1 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-40">{deleting ? 'Deleting…' : 'Delete Forever'}</button>
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
                className="w-full flex items-center gap-3 px-4 py-3.5 text-sm text-red-400 hover:text-red-600 hover:bg-red-50 bg-white border border-red-100 rounded-2xl transition-colors"
              >
                <Trash size={15} weight="bold" />
                <span>Delete my account</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
    </main>

    {/* Editing bottom sheets */}
    <AnimatePresence>
      {openSheet && (
        <>
          <motion.div
            key="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={closeSettingsSheet}
          />
          <motion.div
            key="sheet-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{ y: dragY, paddingBottom: 'env(safe-area-inset-bottom)' }}
            className="fixed inset-x-0 bottom-0 z-[60] bg-white rounded-t-2xl shadow-xl"
          >
            {/* Drag handle */}
            <div
              {...dragHandleProps}
              className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }}
            >
              <div className="w-8 h-1 rounded-full bg-stone-200" />
            </div>

            {openSheet === 'name' && (
              <form onSubmit={handleChangeName} className="px-5 pt-3 pb-6 space-y-4">
                <p className="text-base font-semibold text-stone-800">Display Name</p>
                <FloatingInput
                  label="Your name"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  maxLength={40}
                  required
                />
                <div className="flex gap-3">
                  <button type="button" onClick={closeSettingsSheet} className={cancelCls}>Cancel</button>
                  <button type="submit" disabled={nameSaving || !nameValue.trim()} className={saveCls}>
                    {nameSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}

            {openSheet === 'legal' && (
              <form onSubmit={handleChangeLegalName} className="px-5 pt-3 pb-6 space-y-4">
                <p className="text-base font-semibold text-stone-800">First &amp; Last Name</p>
                <div className="flex gap-2">
                  <FloatingInput
                    label="First"
                    value={editFirst}
                    onChange={e => setEditFirst(e.target.value)}
                    maxLength={40}
                    required
                    autoComplete="given-name"
                    className="flex-1 min-w-0"
                  />
                  <FloatingInput
                    label="Last"
                    value={editLast}
                    onChange={e => setEditLast(e.target.value)}
                    maxLength={40}
                    autoComplete="family-name"
                    className="flex-1 min-w-0"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeSettingsSheet} className={cancelCls}>Cancel</button>
                  <button type="submit" disabled={legalNameSaving || !editFirst.trim()} className={saveCls}>
                    {legalNameSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            )}

            {openSheet === 'birthday' && (
              <div className="px-5 pt-3 pb-6 space-y-4">
                <p className="text-base font-semibold text-stone-800">Birthday</p>
                <div className="flex gap-2">
                  <select
                    value={bdMonth ?? ''}
                    onChange={e => { setBdMonth(Number(e.target.value) || null); setBdDay(null) }}
                    className="flex-1 min-w-0 text-sm bg-white border border-stone-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-ember text-stone-800"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                  <select
                    value={bdDay ?? ''}
                    onChange={e => setBdDay(Number(e.target.value) || null)}
                    className="w-24 shrink-0 text-sm bg-white border border-stone-200 rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-ember text-stone-800"
                  >
                    <option value="">Day</option>
                    {Array.from({ length: daysInMonth(bdMonth) }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeSettingsSheet} className={cancelCls}>Cancel</button>
                  <button type="button" onClick={handleSaveBirthday} disabled={!bdMonth || !bdDay || bdSaving} className={saveCls}>
                    {bdSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            {openSheet === 'password' && (
              <form onSubmit={handleChangePassword} className="px-5 pt-3 pb-6 space-y-4">
                <p className="text-base font-semibold text-stone-800">Change Password</p>
                <FloatingPasswordInput
                  label="Current password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  show={showCurrentPw}
                  onToggle={() => setShowCurrentPw(v => !v)}
                  required
                />
                <FloatingPasswordInput
                  label="New password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  show={showNewPw}
                  onToggle={() => setShowNewPw(v => !v)}
                  required
                />
                <FloatingPasswordInput
                  label="Confirm new password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                />
                {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                <div className="flex gap-3">
                  <button type="button" onClick={closeSettingsSheet} className={cancelCls}>Cancel</button>
                  <button type="submit" disabled={pwSaving || !currentPw || !newPw || !confirmPw} className={saveCls}>
                    {pwSaving ? 'Saving…' : 'Update'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>

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
