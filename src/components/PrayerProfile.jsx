import { useState, useEffect, useRef } from 'react'
import { HandsPraying, Plus, Trash, PencilSimple, MagnifyingGlass, Heart, ArrowLeft, CheckCircle, Confetti, DotsThreeVertical } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { haptic } from '../lib/haptic.js'
import { AvatarIcon, AvatarCircle, avatarColor } from '../lib/avatarIcons.jsx'
import { trackEvent } from '../lib/analytics.js'

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
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
      {extra > 0 && <span className="text-xs text-stone-400 ml-1.5">+{extra}</span>}
    </div>
  )
}

export default function PrayerProfile({ member, displayName, groupId, currentUserId, currentAvatarIcon, currentAvatarColor, currentAvatarImageUrl, onClose, onCountChange }) {
  const toast = useToast()
  const [exiting, setExiting]               = useState(false)
  const [requests, setRequests]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [animDone, setAnimDone]             = useState(false)
  const [addingRequest, setAddingRequest]   = useState(false)
  const [searchQuery, setSearchQuery]       = useState('')
  const [date, setDate]                     = useState(new Date().toISOString().split('T')[0])
  const [requestText, setRequestText]       = useState('')
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState(null)
  const [editingId, setEditingId]           = useState(null)
  const [editDate, setEditDate]             = useState('')
  const [editText, setEditText]             = useState('')
  const [newId, setNewId]                   = useState(null)
  const newIdTimerRef                       = useRef(null)
  const lastTapRef                          = useRef({ id: null, time: 0 })
  const [confirmRequestId, setConfirmRequestId] = useState(null)
  const [reactions, setReactions]           = useState({})
  const [togglingIds, setTogglingIds]       = useState(new Set())
  const [celebratingIds, setCelebratingIds] = useState(() => new Set())
  const [actionSheetReq, setActionSheetReq] = useState(null)
  const [sheetClosing, setSheetClosing]     = useState(false)
  const [addFormExiting, setAddFormExiting] = useState(false)

  const isOwnProfile = member.user_id === currentUserId

  function handleClose() {
    setExiting(true)
    setTimeout(onClose, 210)
  }

  function openActionSheet(req) {
    haptic()
    setSheetClosing(false)
    setActionSheetReq(req)
  }

  function closeActionSheet(callback) {
    const captured = actionSheetReq
    setSheetClosing(true)
    setTimeout(() => {
      setActionSheetReq(null)
      setSheetClosing(false)
      callback?.(captured)
    }, 260)
  }

  function handleBubbleTap(requestId) {
    if (togglingIds.has(requestId)) return
    const now = Date.now()
    if (lastTapRef.current.id === requestId && now - lastTapRef.current.time < 300) {
      lastTapRef.current = { id: null, time: 0 }
      toggleReaction(requestId)
    } else {
      lastTapRef.current = { id: requestId, time: now }
    }
  }

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
        const loaded = data ?? []
        setRequests(loaded)
        setLoading(false)
        const seenKey = 'prayer_celebrated_ids'
        const seen = new Set(JSON.parse(localStorage.getItem(seenKey) ?? '[]'))
        const now = Date.now()
        const unseen = loaded.filter(r =>
          r.answered && r.answered_at &&
          now - new Date(r.answered_at).getTime() < 24 * 60 * 60 * 1000 &&
          !seen.has(r.id)
        )
        if (unseen.length) {
          localStorage.setItem(seenKey, JSON.stringify([...seen, ...unseen.map(r => r.id)]))
          unseen.forEach((r, i) => {
            setTimeout(() => {
              setCelebratingIds(prev => new Set([...prev, r.id]))
              setTimeout(() => setCelebratingIds(prev => { const s = new Set(prev); s.delete(r.id); return s }), 1500)
            }, i * 400 + 600)
          })
        }
      })
  }, [member.user_id])

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
      setReactions(prev => ({ ...prev, [requestId]: (prev[requestId] ?? []).filter(r => r.user_id !== currentUserId) }))
      await supabase.from('prayer_reactions').delete().eq('id', existing.id)
    } else {
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
      setReactions(prev => ({ ...prev, [requestId]: [...(prev[requestId] ?? []), optimistic] }))
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
        setReactions(prev => ({ ...prev, [requestId]: (prev[requestId] ?? []).filter(r => r.id !== optimistic.id) }))
      } else {
        trackEvent('prayer_reaction')
        if (data) setReactions(prev => ({ ...prev, [requestId]: (prev[requestId] ?? []).map(r => r.id === optimistic.id ? data : r) }))
      }
    }
    setTogglingIds(prev => { const s = new Set(prev); s.delete(requestId); return s })
  }

  function cancelAdd() {
    setAddFormExiting(true)
    setTimeout(() => {
      setAddingRequest(false)
      setAddFormExiting(false)
      setRequestText('')
      setDate(new Date().toISOString().split('T')[0])
      setError(null)
    }, 200)
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

  async function handleToggleAnswered(req) {
    const nowAnswered = !req.answered
    const nowAt = nowAnswered ? new Date().toISOString() : null
    setRequests(prev => prev.map(r => r.id === req.id ? { ...r, answered: nowAnswered, answered_at: nowAt } : r))
    if (nowAnswered) {
      setCelebratingIds(prev => new Set([...prev, req.id]))
      setTimeout(() => setCelebratingIds(prev => { const s = new Set(prev); s.delete(req.id); return s }), 1500)
    }
    const { error: err } = await supabase
      .from('prayer_requests')
      .update({ answered: nowAnswered, answered_at: nowAt })
      .eq('id', req.id)
    if (err) {
      toast('Failed to update', 'error')
      setRequests(prev => prev.map(r => r.id === req.id ? { ...r, answered: req.answered, answered_at: req.answered_at } : r))
    }
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

  const sheetReqReactions = reactions[actionSheetReq?.id] ?? []
  const sheetHasReacted   = sheetReqReactions.some(rx => rx.user_id === currentUserId)

  return (
    <>
      {/* Full-screen prayer profile page */}
      <div
        className={`fixed inset-0 bg-white z-40 flex flex-col ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 shrink-0">
          <button
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-stone-500 hover:text-stone-800 hover:bg-stone-100 active:bg-stone-200 transition-colors shrink-0"
            aria-label="Back"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <AvatarCircle size="9" icon={member.avatar_icon} colorKey={member.avatar_color} userId={member.user_id} name={member.display_name} imageUrl={member.avatar_image_url} />
          <h1 className="text-lg font-bold text-stone-800 flex-1 truncate">{member.display_name}</h1>
          {addingRequest ? (
            <button
              onClick={cancelAdd}
              className="text-sm font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => { setAddFormExiting(false); setAddingRequest(true) }}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-lagoon/10 hover:bg-lagoon/20 text-lagoon transition-colors"
              aria-label="Add prayer request"
            >
              <Plus size={18} weight="bold" />
            </button>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: 'max(5rem, env(safe-area-inset-bottom))' }}>
          {addingRequest ? (
            <form onSubmit={handleAdd} className={`space-y-3 px-4 pt-4 pb-5 ${addFormExiting ? 'animate-overlay-out' : 'animate-overlay-in'}`}>
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
                className={`w-full py-2.5 text-white rounded-xl font-medium transition-all text-sm flex items-center justify-center gap-2 ${requestText.trim() ? 'bg-lagoon-600 hover:bg-lagoon-700 shadow-sm' : 'bg-lagoon/40 cursor-not-allowed'}`}
              >
                <Plus size={16} weight="bold" />
                {saving ? 'Adding…' : 'Add Request'}
              </button>
            </form>
          ) : (
            <div className="px-4 pt-4 space-y-3">
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
                <div className="pb-4">
                  {filteredRequests.map((r, idx) => {
                    const requestReactions = reactions[r.id] ?? []
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
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 z-10 ${r.answered ? 'bg-sage-700' : 'bg-lagoon'}`} />
                          {!isLast && <div className="w-px flex-1 bg-stone-200 mt-1" />}
                        </div>
                        {/* Content bubble */}
                        <div className={`flex-1 min-w-0 pl-2 ${isLast ? 'pb-4' : 'pb-5'}`}>
                          <div
                            className={`relative rounded-xl border shadow-sm px-3 py-2.5 select-none ${r.answered ? 'bg-sage/8 border-sage/20' : 'bg-lagoon/8 border-lagoon/20'}`}
                            onClick={() => !isOwnProfile && handleBubbleTap(r.id)}
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
                                <button
                                  onClick={e => { e.stopPropagation(); openActionSheet(r) }}
                                  className="absolute top-2 right-2 p-0.5 text-stone-400 hover:text-stone-600 transition-colors"
                                  aria-label="Request options"
                                >
                                  <DotsThreeVertical size={16} weight="bold" />
                                </button>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <HandsPraying size={13} weight="fill" className={r.answered ? 'text-sage-700' : 'text-lagoon'} />
                                  <span className={`text-xs ${r.answered ? 'text-sage-700' : 'text-lagoon'}`}>Prayer request</span>
                                </div>
                                {r.answered && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sage-700 bg-sage/15 px-2 py-0.5 rounded-full mb-1.5">
                                    <CheckCircle size={10} weight="fill" /> Answered
                                  </span>
                                )}
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
                                {celebratingIds.has(r.id) && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl overflow-hidden">
                                    <Confetti size={56} weight="fill" className="text-sage-700 animate-celebration" />
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

      {/* Action sheet */}
      {actionSheetReq && (
        <div
          className={`fixed inset-0 z-50 flex items-end bg-black/50 ${sheetClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
          onClick={() => closeActionSheet()}
        >
          <div
            className={`bg-white rounded-t-2xl w-full ${sheetClosing ? 'animate-sheet-out' : 'animate-sheet-in'}`}
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Request preview */}
            <div className="px-5 pt-4 pb-3 border-b border-stone-100">
              <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
              <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest mb-1">Prayer request</p>
              <p className="text-sm text-stone-700 line-clamp-2">{actionSheetReq.request}</p>
            </div>
            {/* Action rows */}
            <div className="py-1">
              {!isOwnProfile && (
                <button
                  onClick={() => closeActionSheet(req => toggleReaction(req.id))}
                  disabled={togglingIds.has(actionSheetReq.id)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors disabled:opacity-40"
                >
                  <Heart size={22} weight={sheetHasReacted ? 'fill' : 'regular'} className={sheetHasReacted ? 'text-coral' : 'text-stone-400'} />
                  <span className="text-base text-stone-800 font-medium">{sheetHasReacted ? 'Undo prayer' : 'Pray for'}</span>
                </button>
              )}
              <button
                onClick={() => closeActionSheet(req => handleToggleAnswered(req))}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors"
              >
                <CheckCircle size={22} weight={actionSheetReq.answered ? 'fill' : 'regular'} className={actionSheetReq.answered ? 'text-sage-700' : 'text-stone-400'} />
                <span className="text-base text-stone-800 font-medium">{actionSheetReq.answered ? 'Unmark' : 'Answered'}</span>
              </button>
              <button
                onClick={() => closeActionSheet(req => { setEditingId(req.id); setEditDate(req.date); setEditText(req.request) })}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors"
              >
                <PencilSimple size={22} className="text-stone-400" />
                <span className="text-base text-stone-800 font-medium">Edit</span>
              </button>
              <button
                onClick={() => closeActionSheet(req => setConfirmRequestId(req.id))}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-red-50 active:bg-red-100 transition-colors"
              >
                <Trash size={22} className="text-red-400" />
                <span className="text-base text-red-600 font-medium">Delete</span>
              </button>
            </div>
            {/* Cancel pill */}
            <div className="px-4 pt-1 pb-2">
              <button
                onClick={() => closeActionSheet()}
                className="w-full py-3.5 rounded-2xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 transition-colors text-stone-600 font-semibold text-base"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
