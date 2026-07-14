import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { HandsPraying, X, Plus, Trash, PencilSimple, MagnifyingGlass, Heart, DotsThreeVertical } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import { useToast } from '../lib/toast.jsx'
import { haptic } from '../lib/haptic.js'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'
import { trackEvent } from '../lib/analytics.js'

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatLastUpdated(requests) {
  if (!requests?.length) return null
  const latest = requests.reduce((a, b) =>
    new Date(a.created_at) > new Date(b.created_at) ? a : b
  )
  const d = new Date(latest.created_at)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dDay  = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today - dDay) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ReactionAvatars({ reactions }) {
  if (!reactions?.length) return null
  const MAX = 5
  const shown = reactions.slice(0, MAX)
  const extra = reactions.length - MAX
  return (
    <div className="flex items-center mt-2">
      {shown.map((rx, i) => (
        <div
          key={rx.user_id}
          className={`w-6 h-6 rounded-full border-2 border-white shrink-0 overflow-hidden ${rx.avatar_image_url ? 'bg-stone-200' : `${avatarColor(rx.user_id, rx.avatar_color)} flex items-center justify-center`}`}
          style={{ marginLeft: i === 0 ? 0 : -6, zIndex: shown.length - i }}
          title={rx.display_name}
        >
          {rx.avatar_image_url
            ? <img src={rx.avatar_image_url} alt="" className="w-full h-full object-cover" />
            : rx.avatar_icon
              ? <AvatarIcon name={rx.avatar_icon} size={10} />
              : <span className="text-white text-[8px] font-bold">{(rx.display_name ?? '?').charAt(0).toUpperCase()}</span>
          }
        </div>
      ))}
      {extra > 0 && (
        <span className="text-xs text-stone-400 ml-1.5">+{extra}</span>
      )}
    </div>
  )
}

function PrayerModal({ member, displayName, groupId, currentUserId, currentAvatarIcon, currentAvatarColor, currentAvatarImageUrl, onClose, onCountChange }) {
  const [closing, close] = useModalClose(onClose)
  const toast = useToast()
  const [requests, setRequests]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [animDone, setAnimDone]           = useState(false)
  const [addingRequest, setAddingRequest] = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [date, setDate]                   = useState(new Date().toISOString().split('T')[0])
  const [requestText, setRequestText]     = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)
  const [editingId, setEditingId]         = useState(null)
  const [editDate, setEditDate]           = useState('')
  const [editText, setEditText]           = useState('')
  const [newId, setNewId]                 = useState(null)
  const newIdTimerRef                     = useRef(null)
  const lastTapRef                        = useRef({ id: null, time: 0 })
  const [confirmRequestId, setConfirmRequestId] = useState(null)
  const [openMenuId, setOpenMenuId]             = useState(null)
  const [closingMenuId, setClosingMenuId]       = useState(null)

  function handleBubbleTap(requestId, isOwn) {
    if (isOwn || togglingIds.has(requestId)) return
    const now = Date.now()
    if (lastTapRef.current.id === requestId && now - lastTapRef.current.time < 300) {
      lastTapRef.current = { id: null, time: 0 }
      toggleReaction(requestId)
    } else {
      lastTapRef.current = { id: requestId, time: now }
    }
  }

  function openMenu(id) { setClosingMenuId(null); setOpenMenuId(id) }
  function closeMenu() {
    setClosingMenuId(openMenuId)
    setOpenMenuId(null)
    setTimeout(() => setClosingMenuId(null), 150)
  }
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [reactions, setReactions]         = useState({}) // { [prayer_request_id]: [reaction] }
  const [togglingIds, setTogglingIds]     = useState(new Set())

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onResize() {
      setKeyboardOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    vv.addEventListener('resize', onResize)
    vv.addEventListener('scroll', onResize)
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize) }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setAnimDone(true), 280)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    supabase
      .from('prayer_requests')
      .select('*')
      .eq('member_user_id', member.user_id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRequests(data ?? [])
        setLoading(false)
      })
  }, [member.user_id])

  // Load reactions for all of this member's requests
  useEffect(() => {
    if (!groupId) return
    supabase
      .from('prayer_reactions')
      .select('*')
      .eq('prayer_request_owner_id', member.user_id)
      .then(({ data }) => {
        const map = {}
        for (const r of data ?? []) {
          if (!map[r.prayer_request_id]) map[r.prayer_request_id] = []
          map[r.prayer_request_id].push(r)
        }
        setReactions(map)
      })
  }, [member.user_id, groupId])

  async function toggleReaction(requestId) {
    if (togglingIds.has(requestId)) return
    const existing = reactions[requestId]?.find(r => r.user_id === currentUserId)
    setTogglingIds(prev => new Set(prev).add(requestId))
    haptic()

    if (existing) {
      // Optimistic remove
      setReactions(prev => ({
        ...prev,
        [requestId]: (prev[requestId] ?? []).filter(r => r.user_id !== currentUserId),
      }))
      await supabase.from('prayer_reactions').delete().eq('id', existing.id)
    } else {
      // Optimistic add
      const optimistic = {
        id: `temp-${Date.now()}`,
        prayer_request_id: requestId,
        prayer_request_owner_id: member.user_id,
        community_group_id: groupId,
        user_id: currentUserId,
        display_name: displayName,
        avatar_icon: currentAvatarIcon,
        avatar_color: currentAvatarColor,
        avatar_image_url: currentAvatarImageUrl ?? null,
        created_at: new Date().toISOString(),
      }
      setReactions(prev => ({
        ...prev,
        [requestId]: [...(prev[requestId] ?? []), optimistic],
      }))
      const { data, error: err } = await supabase
        .from('prayer_reactions')
        .insert({
          prayer_request_id:       requestId,
          prayer_request_owner_id: member.user_id,
          community_group_id:      groupId,
          user_id:                 currentUserId,
          display_name:            displayName,
          avatar_icon:             currentAvatarIcon ?? null,
          avatar_color:            currentAvatarColor ?? null,
          avatar_image_url:        currentAvatarImageUrl ?? null,
        })
        .select()
        .maybeSingle()
      if (err) {
        toast('Failed to save reaction', 'error')
        setReactions(prev => ({
          ...prev,
          [requestId]: (prev[requestId] ?? []).filter(r => r.id !== optimistic.id),
        }))
      } else {
        trackEvent('prayer_reaction')
        if (data) {
          setReactions(prev => ({
            ...prev,
            [requestId]: (prev[requestId] ?? []).map(r => r.id === optimistic.id ? data : r),
          }))
        }
      }
    }

    setTogglingIds(prev => { const s = new Set(prev); s.delete(requestId); return s })
  }

  function cancelAdd() {
    setAddingRequest(false)
    setRequestText('')
    setDate(new Date().toISOString().split('T')[0])
    setError(null)
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!requestText.trim()) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('prayer_requests')
      .insert({ member_user_id: member.user_id, date, request: requestText.trim(), added_by: displayName })
      .select()
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    trackEvent('prayer_request_added')
    setRequests(prev => [data, ...prev])
    setNewId(data.id)
    clearTimeout(newIdTimerRef.current)
    newIdTimerRef.current = setTimeout(() => setNewId(null), 500)
    setRequestText('')
    setDate(new Date().toISOString().split('T')[0])
    setSaving(false)
    setAddingRequest(false)
    haptic()
    onCountChange(member.user_id, +1)
  }

  async function handleDeleteRequest(id) {
    const { error: err } = await supabase.from('prayer_requests').delete().eq('id', id)
    if (err) { toast('Failed to delete: ' + err.message, 'error'); return }
    setRequests(prev => prev.filter(r => r.id !== id))
    setReactions(prev => { const next = { ...prev }; delete next[id]; return next })
    setConfirmRequestId(null)
    onCountChange(member.user_id, -1)
  }

  function startEditRequest(r) {
    setEditingId(r.id)
    setEditDate(r.date)
    setEditText(r.request)
  }

  async function handleSaveRequest(e) {
    e.preventDefault()
    if (!editText.trim()) return
    const { data, error: err } = await supabase
      .from('prayer_requests')
      .update({ date: editDate, request: editText.trim() })
      .eq('id', editingId)
      .select()
      .single()
    if (!err) {
      setRequests(prev => prev.map(r => r.id === editingId ? data : r))
      setEditingId(null)
    }
  }

  const q = searchQuery.trim().toLowerCase()
  const filteredRequests = q
    ? requests.filter(r => r.request?.toLowerCase().includes(q) || formatDate(r.date).toLowerCase().includes(q))
    : requests

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end lg:items-center lg:justify-center z-50 ${closing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-t-2xl lg:rounded-2xl shadow-xl w-full lg:max-w-lg flex flex-col min-h-[50vh] max-h-[90vh] lg:max-h-[85vh] ${closing ? 'animate-sheet-out' : 'animate-sheet-in'}`}
        style={{
          marginBottom: keyboardOffset,
          ...(keyboardOffset > 0 && { maxHeight: `${window.innerHeight - keyboardOffset - 32}px` }),
          transition: 'margin-bottom 0.15s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-full shrink-0 overflow-hidden ${member.avatar_image_url ? 'bg-stone-200 shadow ring-1 ring-black/10' : `${avatarColor(member.user_id, member.avatar_color)} flex items-center justify-center`}`}>
              {member.avatar_image_url
                ? <img src={member.avatar_image_url} alt="" className="w-full h-full object-cover" />
                : member.avatar_icon
                  ? <AvatarIcon name={member.avatar_icon} size={16} />
                  : <span className="text-white font-bold text-sm">{(member.display_name ?? '?').charAt(0).toUpperCase()}</span>
              }
            </div>
            <h2 className="text-xl font-bold text-stone-800 truncate">{member.display_name}</h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {addingRequest ? (
              <button
                onClick={cancelAdd}
                className="text-sm font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setAddingRequest(true)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-lagoon/10 hover:bg-lagoon/20 text-lagoon transition-colors"
              >
                <Plus size={18} weight="bold" />
              </button>
            )}
            <button
              onClick={close}
              className="shrink-0 text-stone-400 hover:text-stone-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto min-h-0 px-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {addingRequest ? (
            <form onSubmit={handleAdd} className="space-y-3 pb-5">
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full appearance-none border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-lagoon focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Prayer Request</label>
                <textarea
                  autoFocus
                  value={requestText}
                  onChange={e => setRequestText(e.target.value)}
                  placeholder="Write a prayer request…"
                  rows={4}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-lagoon focus:border-transparent text-sm resize-none"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={saving || !requestText.trim()}
                className="w-full py-2.5 bg-lagoon hover:bg-lagoon-600 text-white rounded-xl font-medium disabled:opacity-40 transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Plus size={16} weight="bold" />
                {saving ? 'Adding…' : 'Add Request'}
              </button>
            </form>
          ) : (
            <div className="pb-4 space-y-3">
              {/* Search */}
              {!loading && animDone && requests.length > 1 && (
                <div className="relative">
                  <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search requests…"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-lagoon focus:border-transparent"
                  />
                </div>
              )}

              {/* Request list */}
              {loading || !animDone ? (
                <div>
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="w-14 shrink-0 pr-3 pt-0.5 flex flex-col items-end gap-1">
                        <div className="h-2 bg-stone-200 rounded w-7" />
                        <div className="h-6 bg-stone-200 rounded w-9" />
                        <div className="h-2 bg-stone-200 rounded w-10" />
                      </div>
                      <div className="flex flex-col items-center w-5 shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-stone-200 mt-1.5 shrink-0" />
                        {i < 2 && <div className="w-px flex-1 bg-stone-200 mt-1" />}
                      </div>
                      <div className="flex-1 pl-2 pb-6">
                        <div className="h-3 bg-stone-200 rounded w-full mb-2 mt-0.5" />
                        <div className="h-3 bg-stone-200 rounded w-4/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRequests.length === 0 ? (
                <p className="text-sm text-stone-400 text-center py-6">
                  {q ? 'No requests match your search.' : 'No requests yet. Tap + to add one!'}
                </p>
              ) : (
                <div>
                  {filteredRequests.map((r, idx) => {
                    const requestReactions = reactions[r.id] ?? []
                    const hasReacted = requestReactions.some(rx => rx.user_id === currentUserId)
                    const isOwnProfile = member.user_id === currentUserId
                    const isLast = idx === filteredRequests.length - 1
                    const [yr, mo, dy] = r.date.split('-').map(Number)
                    const dateObj = new Date(yr, mo - 1, dy)
                    const mon = dateObj.toLocaleDateString('en-US', { month: 'short' })
                    return (
                      <div key={r.id} className={`flex ${newId === r.id ? 'animate-fade-up' : ''}`}>
                        {/* Date column */}
                        <div className="w-14 shrink-0 text-right pr-3 pt-0.5">
                          <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider leading-none">{mon}</p>
                          <p className="text-2xl font-bold text-stone-700 leading-none mt-0.5">{dy}</p>
                          <p className="text-[10px] text-stone-400 leading-none mt-0.5">{yr}</p>
                        </div>
                        {/* Spine */}
                        <div className="flex flex-col items-center w-5 shrink-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-lagoon mt-1.5 shrink-0 z-10" />
                          {!isLast && <div className="w-px flex-1 bg-stone-200 mt-1" />}
                        </div>
                        {/* Content */}
                        <div className={`flex-1 min-w-0 pl-2 ${isLast ? 'pb-1' : 'pb-5'}`}>
                          <div
                            className="relative bg-lagoon/8 rounded-xl border border-lagoon/20 shadow-sm px-3 py-2.5 select-none"
                            onClick={() => handleBubbleTap(r.id, isOwnProfile)}
                          >
                          {editingId === r.id ? (
                            <form onSubmit={handleSaveRequest} className="space-y-2 pb-1">
                              <input
                                type="date"
                                value={editDate}
                                onChange={e => setEditDate(e.target.value)}
                                className="w-full appearance-none border border-stone-300 rounded-lg px-3 py-1.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-lagoon focus:border-transparent text-sm"
                              />
                              <textarea
                                value={editText}
                                onChange={e => setEditText(e.target.value)}
                                rows={3}
                                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-lagoon focus:border-transparent text-sm resize-none"
                                required
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="flex-1 py-1.5 border border-stone-300 rounded-lg text-stone-600 text-xs font-medium hover:bg-stone-100 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={!editText.trim()}
                                  className="flex-1 py-1.5 bg-lagoon hover:bg-lagoon-600 text-white rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                                >
                                  Save
                                </button>
                              </div>
                            </form>
                          ) : (
                            <>
                              <div className="absolute top-2 right-2">
                                <button
                                  onClick={e => { e.stopPropagation(); openMenuId === r.id ? closeMenu() : openMenu(r.id) }}
                                  className="p-0.5 text-stone-400 hover:text-stone-600 transition-colors"
                                >
                                  <DotsThreeVertical size={16} weight="bold" />
                                </button>
                                {(openMenuId === r.id || closingMenuId === r.id) && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={closeMenu} />
                                    <div className={`absolute right-0 top-6 bg-white rounded-xl shadow-lg border border-stone-200 z-20 py-1 min-w-[150px] origin-top-right ${closingMenuId === r.id ? 'animate-popup-out' : 'animate-popup-in'}`}>
                                      {!isOwnProfile && (
                                        <button
                                          onClick={() => { toggleReaction(r.id); closeMenu() }}
                                          disabled={togglingIds.has(r.id)}
                                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-40"
                                        >
                                          <Heart size={15} weight={hasReacted ? 'fill' : 'regular'} className={hasReacted ? 'text-coral' : 'text-stone-400'} />
                                          {hasReacted ? 'Undo prayer' : 'Pray for'}
                                        </button>
                                      )}
                                      <button
                                        onClick={() => { startEditRequest(r); closeMenu() }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                                      >
                                        <PencilSimple size={15} className="text-stone-400" />
                                        Edit
                                      </button>
                                      <button
                                        onClick={() => { setConfirmRequestId(r.id); closeMenu() }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                      >
                                        <Trash size={15} className="text-red-400" />
                                        Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <HandsPraying size={13} weight="fill" className="text-lagoon" />
                                <span className="text-xs text-lagoon">Prayer request</span>
                              </div>
                              <p className="text-sm text-stone-700 leading-relaxed pr-6">{r.request}</p>
                              <ReactionAvatars reactions={requestReactions} />
                              {confirmRequestId === r.id && (
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-stone-200">
                                  <span className="text-xs text-stone-500 flex-1">Delete this request?</span>
                                  <button
                                    onClick={() => setConfirmRequestId(null)}
                                    className="text-xs text-stone-400 hover:text-stone-600 font-medium px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRequest(r.id)}
                                    className="text-xs text-white bg-red-500 hover:bg-red-600 font-medium px-2 py-1 rounded-lg transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MemberCard({ member, index, onClick }) {
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation('/prayer', index)
  const lastUpdated = formatLastUpdated(member.prayer_requests)

  return (
    <button
      onClick={onClick}
      style={entranceStyle}
      className={`w-full text-left p-4 rounded-xl bg-white border-2 border-stone-200 hover:border-lagoon/40 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-lagoon ${entranceClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full shrink-0 overflow-hidden ${member.avatar_image_url ? 'bg-stone-200 shadow ring-1 ring-black/10' : `${avatarColor(member.user_id, member.avatar_color)} flex items-center justify-center`}`}>
            {member.avatar_image_url
              ? <img src={member.avatar_image_url} alt="" className="w-full h-full object-cover" />
              : member.avatar_icon
                ? <AvatarIcon name={member.avatar_icon} size={20} />
                : <span className="text-white font-bold text-sm">{(member.display_name ?? '?').charAt(0).toUpperCase()}</span>
            }
          </div>
          <div className="font-semibold text-stone-800">{member.display_name}</div>
        </div>
        {lastUpdated && (
          <span className="text-xs text-stone-400 shrink-0">{lastUpdated}</span>
        )}
      </div>
    </button>
  )
}

export default function PrayerTab({ displayName, groupId, isAdmin, onOpenSettings, userId, avatarIcon, avatarColorKey, avatarImageUrl }) {
  const location = useLocation()
  const featuredUserId = location.state?.featuredUserId
  const [members, setMembers]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)
  const [searchQuery, setSearchQuery]       = useState('')

  useEffect(() => {
    if (!featuredUserId || members.length === 0 || selectedMember) return
    const featured = members.find(m => m.user_id === featuredUserId)
    if (featured) setSelectedMember(featured)
  }, [members, featuredUserId])

  async function load() {
    if (!groupId) return
    try {
      const [membersRes, requestsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_icon, avatar_color, avatar_image_url').eq('community_group_id', groupId).order('display_name'),
        supabase.from('prayer_requests').select('id, member_user_id, created_at'),
      ])
      const profileList = membersRes.data ?? []
      const requestList = requestsRes.data ?? []
      setMembers(profileList.map(m => ({
        ...m,
        prayer_requests: requestList.filter(r => r.member_user_id === m.user_id),
      })))
    } finally {
      setLoading(false)
    }
  }

  const { pullDistance, refreshing, threshold } = usePullToRefresh(load, !selectedMember)

  useEffect(() => { if (groupId) load() }, [groupId])

  function handleCountChange(userId, delta) {
    setMembers(prev => prev.map(m => {
      if (m.user_id !== userId) return m
      const updated = delta > 0
        ? [...(m.prayer_requests ?? []), { id: 'temp', created_at: new Date().toISOString() }]
        : (m.prayer_requests ?? []).slice(1)
      return { ...m, prayer_requests: updated }
    }))
  }

  const filteredMembers = searchQuery.trim()
    ? members.filter(m => m.display_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : members

  return (
    <main className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12">
      {pullDistance > 0 && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center transition-transform"
          style={{ top: 'calc(env(safe-area-inset-top) + 8px)', transform: `translateY(${Math.min(pullDistance, threshold) * 0.6}px)` }}
        >
          <div className={`w-8 h-8 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            <div className="w-3 h-3 rounded-full border-2 border-lagoon border-t-transparent" style={{ opacity: pullDistance / threshold }} />
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Prayer Requests</h1>
          <p className="text-stone-500 mt-1 text-sm">
            {!loading && (members.length === 0
              ? 'No members yet'
              : `${members.length} member${members.length !== 1 ? 's' : ''}`
            )}
          </p>
        </div>
      </div>

      {!loading && members.length > 0 && (
        <div className="relative mb-4">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search members…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-lagoon focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white border-2 border-stone-200 rounded-xl p-4 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-stone-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-stone-200 rounded w-2/5" />
                </div>
                <div className="h-3 bg-stone-100 rounded w-12" />
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="flex justify-center mb-3">
            <HandsPraying size={48} weight="fill" className="text-stone-300" />
          </div>
          <p className="text-sm">No members in this group yet</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12 text-stone-400">
          <MagnifyingGlass size={40} className="mx-auto mb-2 text-stone-300" />
          <p className="text-sm">No members match "{searchQuery}"</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member, i) => (
            <MemberCard
              key={member.user_id}
              member={member}
              index={i}
              onClick={() => setSelectedMember(member)}
            />
          ))}
        </div>
      )}

      {selectedMember && (
        <PrayerModal
          member={selectedMember}
          displayName={displayName}
          groupId={groupId}
          currentUserId={userId}
          currentAvatarIcon={avatarIcon}
          currentAvatarColor={avatarColorKey}
          currentAvatarImageUrl={avatarImageUrl}
          onClose={() => setSelectedMember(null)}
          onCountChange={handleCountChange}
        />
      )}
    </main>
  )
}
