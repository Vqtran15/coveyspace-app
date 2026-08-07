import { useState, useEffect } from 'react'
import { HandsPraying, ArrowLeft, Trash, PencilSimple, CheckCircle, DotsThreeVertical, X, Confetti } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { haptic } from '../lib/haptic.js'
import { AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'
import { useModalClose } from '../hooks/useModalClose.js'

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatMemberNames(firstNames) {
  if (firstNames.length === 0) return 'Group'
  if (firstNames.length === 1) return firstNames[0]
  if (firstNames.length === 2) return `${firstNames[0]} & ${firstNames[1]}`
  return `${firstNames.slice(0, -1).join(', ')} & ${firstNames[firstNames.length - 1]}`
}

function MemberPill({ profile }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center ${profile.avatar_image_url ? 'bg-stone-200' : avatarColor(profile.user_id, profile.avatar_color)}`}>
        {profile.avatar_image_url
          ? <img src={profile.avatar_image_url} alt="" className="w-full h-full object-cover" />
          : profile.avatar_icon
            ? <AvatarIcon name={profile.avatar_icon} size={22} />
            : <span className="text-white text-sm font-bold">{(profile.display_name ?? '?').charAt(0).toUpperCase()}</span>
        }
      </div>
      <span className="text-xs text-stone-600 font-medium text-center leading-tight max-w-[56px] truncate">
        {profile.display_name?.split(' ')[0]}
      </span>
    </div>
  )
}

function ReactionAvatars({ reactions }) {
  if (!reactions?.length) return null
  const MAX = 6
  const shown = reactions.slice(0, MAX)
  const extra = reactions.length - MAX
  return (
    <div className="flex items-center">
      {shown.map((rx, i) => (
        <div
          key={rx.user_id}
          className={`w-7 h-7 rounded-full border-2 border-white shrink-0 overflow-hidden ${rx.avatar_image_url ? 'bg-stone-200' : `${avatarColor(rx.user_id, rx.avatar_color)} flex items-center justify-center`}`}
          style={{ marginLeft: i === 0 ? 0 : -8, zIndex: shown.length - i }}
          title={rx.display_name}
        >
          {rx.avatar_image_url
            ? <img src={rx.avatar_image_url} alt="" className="w-full h-full object-cover" />
            : rx.avatar_icon
              ? <AvatarIcon name={rx.avatar_icon} size={12} />
              : <span className="text-white text-[9px] font-bold">{(rx.display_name ?? '?').charAt(0).toUpperCase()}</span>
          }
        </div>
      ))}
      {extra > 0 && <span className="text-xs text-stone-400 ml-1.5">+{extra}</span>}
    </div>
  )
}

export default function GroupPrayerProfile({ groupPrayer: initialPrayer, memberProfiles, displayName, groupId, currentUserId, isAdmin, currentAvatarIcon, currentAvatarColor, currentAvatarImageUrl, onClose, onUpdate }) {
  const toast = useToast()
  const [prayer, setPrayer]       = useState(initialPrayer)
  const [exiting, setExiting]     = useState(false)
  const [reactions, setReactions] = useState([])
  const [toggling, setToggling]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [editText, setEditText]   = useState(initialPrayer.request)
  const [saving, setSaving]       = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [actionSheetOpen, setActionSheetOpen] = useState(false)
  const [actionSheetClosing, closeActionSheet, resetActionSheet] = useModalClose(() => setActionSheetOpen(false))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmDeleteClosing, closeConfirmDelete, resetConfirmDelete] = useModalClose(() => setConfirmDelete(false))

  const canManage = prayer.created_by === currentUserId || isAdmin
  const userReacted = reactions.some(r => r.user_id === currentUserId)
  const firstNames = memberProfiles.map(p => p.display_name?.split(' ')[0]).filter(Boolean)

  useEffect(() => {
    supabase
      .from('group_prayer_reactions')
      .select('*')
      .eq('group_prayer_request_id', prayer.id)
      .then(({ data }) => setReactions(data ?? []))
  }, [prayer.id])

  function handleClose() {
    setExiting(true)
    setTimeout(onClose, 210)
  }

  async function toggleReaction() {
    if (toggling) return
    const existing = reactions.find(r => r.user_id === currentUserId)
    setToggling(true)
    haptic()
    if (existing) {
      setReactions(prev => prev.filter(r => r.user_id !== currentUserId))
      await supabase.from('group_prayer_reactions').delete().eq('id', existing.id)
    } else {
      const optimistic = {
        id: `temp-${Date.now()}`,
        group_prayer_request_id: prayer.id,
        community_group_id: groupId,
        user_id: currentUserId,
        display_name: displayName,
        avatar_icon: currentAvatarIcon ?? null,
        avatar_color: currentAvatarColor ?? null,
        avatar_image_url: currentAvatarImageUrl ?? null,
      }
      setReactions(prev => [...prev, optimistic])
      const { data, error: err } = await supabase
        .from('group_prayer_reactions')
        .insert({
          group_prayer_request_id: prayer.id,
          community_group_id: groupId,
          user_id: currentUserId,
          display_name: displayName,
          avatar_icon: currentAvatarIcon ?? null,
          avatar_color: currentAvatarColor ?? null,
          avatar_image_url: currentAvatarImageUrl ?? null,
        })
        .select()
        .maybeSingle()
      if (err) {
        toast('Failed to save reaction', 'error')
        setReactions(prev => prev.filter(r => r.id !== optimistic.id))
      } else if (data) {
        setReactions(prev => prev.map(r => r.id === optimistic.id ? data : r))
      }
    }
    setToggling(false)
  }

  async function handleSaveEdit() {
    if (!editText.trim() || saving) return
    setSaving(true)
    const { error: err } = await supabase
      .from('group_prayer_requests')
      .update({ request: editText.trim() })
      .eq('id', prayer.id)
    if (err) { toast('Failed to save', 'error'); setSaving(false); return }
    const updated = { ...prayer, request: editText.trim() }
    setPrayer(updated)
    onUpdate?.(updated)
    setSaving(false)
    setEditing(false)
  }

  async function handleToggleAnswered() {
    const nowAnswered = !prayer.answered
    const nowAt = nowAnswered ? new Date().toISOString() : null
    const { error: err } = await supabase
      .from('group_prayer_requests')
      .update({ answered: nowAnswered, answered_at: nowAt })
      .eq('id', prayer.id)
    if (err) { toast('Failed to update', 'error'); return }
    const updated = { ...prayer, answered: nowAnswered, answered_at: nowAt }
    setPrayer(updated)
    onUpdate?.(updated)
    if (nowAnswered) {
      setCelebrating(true)
      setTimeout(() => setCelebrating(false), 1500)
    }
    closeActionSheet()
  }

  async function handleDelete() {
    const { error: err } = await supabase.from('group_prayer_requests').delete().eq('id', prayer.id)
    if (err) { toast('Failed to delete', 'error'); return }
    onUpdate?.({ ...prayer, _deleted: true })
    handleClose()
  }

  return (
    <div className={`fixed inset-0 z-50 bg-sunrise-50 flex flex-col ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}>

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-safe-or-4 pb-3 pt-4 border-b border-stone-100">
        <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors">
          <ArrowLeft size={22} weight="bold" className="text-stone-600" />
        </button>
        <span className="font-semibold text-stone-800">Shared Prayer</span>
        {canManage ? (
          <button
            onClick={() => { resetActionSheet(); setActionSheetOpen(true) }}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
          >
            <DotsThreeVertical size={22} weight="bold" className="text-stone-500" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">

        {/* Member avatars */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-4">Praying for</p>
          <div className="flex flex-wrap gap-4">
            {memberProfiles.map(p => <MemberPill key={p.user_id} profile={p} />)}
          </div>
        </div>

        {/* Request text */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Prayer Request</p>
            {canManage && !editing && (
              <button onClick={() => setEditing(true)} className="text-stone-400 hover:text-ember transition-colors shrink-0">
                <PencilSimple size={16} />
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-2">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                rows={4}
                autoFocus
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent resize-none"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setEditing(false); setEditText(prayer.request) }}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editText.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-ember text-white text-sm font-semibold disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-700 leading-relaxed mt-2">{prayer.request}</p>
          )}

          <p className="text-xs text-stone-400 mt-3">
            Added by {prayer.added_by || 'someone'} · {formatDate(prayer.created_at)}
          </p>
        </div>

        {/* Answered banner */}
        {prayer.answered && (
          <div className={`flex items-center gap-3 bg-sage/10 border border-sage/30 rounded-2xl px-4 py-3 ${celebrating ? 'animate-card-pulse' : ''}`}>
            <Confetti size={20} weight="fill" className="text-sage-700 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-sage-700">Prayer answered!</p>
              {prayer.answered_at && (
                <p className="text-xs text-sage-700 mt-0.5">{formatDate(prayer.answered_at)}</p>
              )}
            </div>
          </div>
        )}

        {/* Pray section */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Who's praying</p>
              {reactions.length > 0
                ? <ReactionAvatars reactions={reactions} />
                : <p className="text-sm text-stone-400">Be the first to pray</p>
              }
            </div>
            <button
              onClick={toggleReaction}
              disabled={toggling}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                userReacted
                  ? 'bg-ember/10 text-ember'
                  : 'bg-stone-100 text-stone-600 hover:bg-ember/10 hover:text-ember'
              }`}
            >
              <HandsPraying size={18} weight={userReacted ? 'fill' : 'regular'} />
              {userReacted ? 'Praying' : 'Pray'}
            </button>
          </div>
        </div>

      </div>

      {/* Action sheet */}
      {actionSheetOpen && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end z-50 ${actionSheetClosing ? 'animate-backdrop-out' : 'animate-overlay-in'}`}
          onClick={closeActionSheet}
        >
          <div
            className={`bg-white rounded-t-2xl w-full max-w-lg mx-auto pb-safe ${actionSheetClosing ? 'animate-sheet-out' : 'animate-modal-in'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-stone-200" />
            </div>
            <div className="px-4 pt-2 pb-3 space-y-1">
              <button
                onClick={handleToggleAnswered}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors text-left"
              >
                {prayer.answered
                  ? <><X size={20} className="text-stone-500" /><span className="text-sm font-medium">Mark as unanswered</span></>
                  : <><CheckCircle size={20} className="text-sage-700" /><span className="text-sm font-medium text-sage-700">Mark as answered</span></>
                }
              </button>
              <button
                onClick={() => { closeActionSheet(); setTimeout(() => { resetConfirmDelete(); setConfirmDelete(true) }, 270) }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors text-left"
              >
                <Trash size={20} />
                <span className="text-sm font-medium">Delete shared prayer</span>
              </button>
            </div>
            <div className="px-4 pb-6">
              <button onClick={closeActionSheet} className="w-full py-3.5 rounded-2xl bg-stone-100 text-stone-600 text-sm font-semibold hover:bg-stone-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end z-50 ${confirmDeleteClosing ? 'animate-backdrop-out' : 'animate-overlay-in'}`}
          onClick={closeConfirmDelete}
        >
          <div
            className={`bg-white rounded-t-2xl w-full max-w-lg mx-auto pb-safe ${confirmDeleteClosing ? 'animate-sheet-out' : 'animate-modal-in'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-6">
              <h2 className="text-lg font-bold text-stone-800 mb-1">Delete shared prayer?</h2>
              <p className="text-sm text-stone-500 mb-5">
                Prayer for <span className="font-semibold text-stone-700">{formatMemberNames(firstNames)}</span> will be permanently removed for everyone.
              </p>
              <div className="flex gap-3">
                <button onClick={closeConfirmDelete} className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleDelete} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">
                  Delete forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
