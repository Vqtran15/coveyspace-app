import { useState, useEffect, useRef } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { HandsPraying, MagnifyingGlass, X, CaretRight, Users, Plus, Check } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { AvatarCircle, AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'
import { haptic } from '../lib/haptic.js'
import PrayerProfile from './PrayerProfile.jsx'
import GroupPrayerProfile from './GroupPrayerProfile.jsx'

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

function formatRelativeDate(dateStr) {
  const d    = new Date(dateStr)
  const now  = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dDay  = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today - dDay) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMemberNames(firstNames) {
  if (firstNames.length === 0) return 'Group'
  if (firstNames.length === 1) return firstNames[0]
  if (firstNames.length === 2) return `${firstNames[0]} & ${firstNames[1]}`
  return `${firstNames.slice(0, -1).join(', ')} & ${firstNames[firstNames.length - 1]}`
}

// ─── Individual member card ───────────────────────────────────────────────────

function MemberCard({ member, index, onClick }) {
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation('/prayer', index)
  const lastUpdated = formatLastUpdated(member.prayer_requests)

  return (
    <motion.button
      onClick={onClick}
      style={entranceStyle}
      className={`w-full text-left p-4 rounded-2xl bg-white border border-stone-100 shadow-sm transition-all active:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-ember ${entranceClass}`}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarCircle size="md" icon={member.avatar_icon} colorKey={member.avatar_color} userId={member.user_id} name={member.display_name} imageUrl={member.avatar_image_url} />
          <div className="font-semibold text-stone-800">{member.display_name}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && <span className="text-xs text-stone-400">{lastUpdated}</span>}
          <CaretRight size={14} weight="bold" className="text-stone-300" />
        </div>
      </div>
    </motion.button>
  )
}

// ─── Group prayer card (members view) ────────────────────────────────────────

function GroupPrayerCard({ groupPrayer, memberMap, index, onClick }) {
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation('/prayer', index)
  const profiles  = groupPrayer.member_user_ids.map(id => memberMap[id]).filter(Boolean)
  const firstNames = profiles.map(p => p.display_name?.split(' ')[0]).filter(Boolean)
  const label      = formatMemberNames(firstNames)
  const MAX = 3
  const shown = profiles.slice(0, MAX)
  const extra = profiles.length - MAX
  const stackWidth = shown.length * 26 + 10 + (extra > 0 ? 26 : 0)

  return (
    <motion.button
      onClick={onClick}
      style={entranceStyle}
      className={`w-full text-left p-4 rounded-2xl bg-white border border-stone-100 shadow-sm transition-all active:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-ember ${entranceClass}`}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center shrink-0" style={{ width: stackWidth }}>
            {shown.map((p, i) => (
              <div
                key={p.user_id}
                className={`w-9 h-9 rounded-full border-2 border-white overflow-hidden flex items-center justify-center shrink-0 ${p.avatar_image_url ? 'bg-stone-200' : avatarColor(p.user_id, p.avatar_color)}`}
                style={{ marginLeft: i === 0 ? 0 : -10, zIndex: shown.length - i }}
              >
                {p.avatar_image_url
                  ? <img src={p.avatar_image_url} alt="" className="w-full h-full object-cover" />
                  : p.avatar_icon
                    ? <AvatarIcon name={p.avatar_icon} size={18} />
                    : <span className="text-white text-xs font-bold">{(p.display_name ?? '?').charAt(0).toUpperCase()}</span>
                }
              </div>
            ))}
            {extra > 0 && (
              <div
                className="w-9 h-9 rounded-full border-2 border-white bg-stone-100 flex items-center justify-center shrink-0"
                style={{ marginLeft: -10 }}
              >
                <span className="text-xs font-bold text-stone-500">+{extra}</span>
              </div>
            )}
          </div>
          <div className="font-semibold text-stone-800 truncate">{label}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-stone-400">{formatRelativeDate(groupPrayer.created_at)}</span>
          <CaretRight size={14} weight="bold" className="text-stone-300" />
        </div>
      </div>
    </motion.button>
  )
}

// ─── Shared reaction avatars ──────────────────────────────────────────────────

function ReactionAvatars({ reactions }) {
  if (!reactions?.length) return null
  const MAX = 5
  const shown = reactions.slice(0, MAX)
  const extra = reactions.length - MAX
  return (
    <div className="flex items-center">
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

// ─── Individual feed card ─────────────────────────────────────────────────────

function FeedCard({ req, member, reactions, currentUserId, isOwnRequest, toggling, onPray, onOpen, index }) {
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation('/prayer', index)
  const reactionCount = reactions?.length ?? 0
  const userReacted   = reactions?.some(r => r.user_id === currentUserId) ?? false

  return (
    <div style={entranceStyle} className={`bg-white border border-stone-100 rounded-2xl p-4 shadow-sm ${entranceClass}`}>
      <div className="flex items-center justify-between mb-2.5">
        <button onClick={onOpen} className="flex items-center gap-2 min-w-0">
          <AvatarCircle size="8" icon={member?.avatar_icon} colorKey={member?.avatar_color} userId={member?.user_id} name={member?.display_name} imageUrl={member?.avatar_image_url} />
          <span className="text-sm font-semibold text-stone-700 truncate">{member?.display_name}</span>
        </button>
        <span className="text-xs text-stone-400 shrink-0 ml-2">{formatRelativeDate(req.created_at)}</span>
      </div>
      <button onClick={onOpen} className="w-full text-left">
        <p className="text-sm text-stone-700 leading-relaxed">{req.request}</p>
      </button>
      {(reactionCount > 0 || !isOwnRequest) && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-stone-100">
          <ReactionAvatars reactions={reactions} />
          {!isOwnRequest && (
            <motion.button
              key={userReacted}
              onClick={onPray}
              disabled={toggling}
              initial={userReacted ? { scale: 0.82 } : false}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 520, damping: 15 }}
              whileTap={{ scale: 0.87 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                userReacted ? 'bg-ember/10 text-ember' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
              }`}
            >
              <HandsPraying size={16} weight={userReacted ? 'fill' : 'regular'} />
              <span>{userReacted ? 'Praying' : 'Pray'}</span>
            </motion.button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Group feed card ──────────────────────────────────────────────────────────

function GroupFeedCard({ groupPrayer, memberMap, reactions, currentUserId, toggling, onPray, onOpen, index }) {
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation('/prayer', index)
  const profiles   = groupPrayer.member_user_ids.map(id => memberMap[id]).filter(Boolean)
  const firstNames = profiles.map(p => p.display_name?.split(' ')[0]).filter(Boolean)
  const label      = formatMemberNames(firstNames)
  const userReacted = reactions?.some(r => r.user_id === currentUserId) ?? false

  return (
    <div style={entranceStyle} className={`bg-white border border-stone-100 rounded-2xl p-4 shadow-sm ${entranceClass}`}>
      <div className="flex items-center justify-between mb-2.5">
        <button onClick={onOpen} className="flex items-center gap-2 min-w-0">
          <div className="flex items-center shrink-0">
            {profiles.slice(0, 3).map((p, i) => (
              <div
                key={p.user_id}
                className={`w-7 h-7 rounded-full border-2 border-white shrink-0 overflow-hidden flex items-center justify-center ${p.avatar_image_url ? 'bg-stone-200' : avatarColor(p.user_id, p.avatar_color)}`}
                style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }}
              >
                {p.avatar_image_url
                  ? <img src={p.avatar_image_url} alt="" className="w-full h-full object-cover" />
                  : p.avatar_icon
                    ? <AvatarIcon name={p.avatar_icon} size={13} />
                    : <span className="text-white text-[9px] font-bold">{(p.display_name ?? '?').charAt(0).toUpperCase()}</span>
                }
              </div>
            ))}
          </div>
          <span className="text-sm font-semibold text-stone-700 truncate">{label}</span>
        </button>
        <span className="text-xs text-stone-400 shrink-0 ml-2">{formatRelativeDate(groupPrayer.created_at)}</span>
      </div>
      <button onClick={onOpen} className="w-full text-left">
        <p className="text-sm text-stone-700 leading-relaxed">{groupPrayer.request}</p>
      </button>
      <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-stone-100">
        <ReactionAvatars reactions={reactions} />
        <motion.button
          key={userReacted}
          onClick={onPray}
          disabled={toggling}
          initial={userReacted ? { scale: 0.82 } : false}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 15 }}
          whileTap={{ scale: 0.87 }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            userReacted ? 'bg-ember/10 text-ember' : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
          }`}
        >
          <HandsPraying size={16} weight={userReacted ? 'fill' : 'regular'} />
          <span>{userReacted ? 'Praying' : 'Pray'}</span>
        </motion.button>
      </div>
    </div>
  )
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function PrayerTab({ displayName, groupId, isAdmin, onOpenSettings, userId, avatarIcon, avatarColorKey, avatarImageUrl }) {
  const location = useLocation()
  const featuredUserId = location.state?.featuredUserId
  const toast = useToast()

  const [members, setMembers]               = useState([])
  const [allRequests, setAllRequests]       = useState([])
  const [allReactions, setAllReactions]     = useState({})
  const [groupPrayers, setGroupPrayers]     = useState([])
  const [groupReactions, setGroupReactions] = useState({})
  const [loading, setLoading]               = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedGroupPrayer, setSelectedGroupPrayer] = useState(null)
  const [searchQuery, setSearchQuery]       = useState('')
  const [viewMode, setViewMode]             = useState('members')
  const [contentAnimClass, setContentAnimClass] = useState('animate-slide-in-right')
  const [searchOpen, setSearchOpen]         = useState(false)
  const [togglingIds, setTogglingIds]       = useState(new Set())
  const hasAutoOpenedRef = useRef(false)
  const viewSwitchRef    = useRef(false)
  const searchInputRef   = useRef(null)
  const tabResetRef      = useRef(location.state?.tabReset ?? null)

  function switchViewMode(newMode) {
    if (newMode === viewMode || viewSwitchRef.current) return
    viewSwitchRef.current = true
    const goRight = newMode === 'feed'
    setContentAnimClass(goRight ? 'animate-slide-out-left' : 'animate-slide-out-right')
    setTimeout(() => {
      setViewMode(newMode)
      setContentAnimClass(goRight ? 'animate-slide-in-right' : 'animate-slide-in-left')
      viewSwitchRef.current = false
    }, 180)
  }

  useEffect(() => {
    const reset = location.state?.tabReset
    if (reset && reset !== tabResetRef.current) {
      tabResetRef.current = reset
      setSelectedMember(null)
      setSelectedGroupPrayer(null)
    }
  }, [location.state?.tabReset])

  // Group prayer creation
  const [showCreate, setShowCreate]               = useState(false)
  const [createClosing, closeCreate, resetCreate] = useModalClose(() => setShowCreate(false))
  const [selectedMemberIds, setSelectedMemberIds] = useState(new Set())
  const [requestText, setRequestText]             = useState('')
  const [creating, setCreating]                   = useState(false)

  useEffect(() => {
    if (hasAutoOpenedRef.current) return
    if (!featuredUserId || members.length === 0 || selectedMember) return
    const featured = members.find(m => m.user_id === featuredUserId)
    if (featured) {
      hasAutoOpenedRef.current = true
      setSelectedMember(featured)
    }
  }, [members, featuredUserId])

  async function load() {
    if (!groupId) return
    try {
      const [membersRes, reactionsRes, groupPrayersRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_icon, avatar_color, avatar_image_url').eq('community_group_id', groupId).order('display_name'),
        supabase.from('prayer_reactions').select('id, prayer_request_id, user_id, display_name, avatar_icon, avatar_color, avatar_image_url, prayer_request_owner_id, community_group_id').eq('community_group_id', groupId),
        supabase.from('group_prayer_requests').select('*').eq('community_group_id', groupId).order('created_at', { ascending: false }),
      ])

      const profileList  = membersRes.data  ?? []
      const reactionList = reactionsRes.data ?? []
      const gpList       = groupPrayersRes.data ?? []

      const memberIds = profileList.map(m => m.user_id)
      const requestsRes = memberIds.length
        ? await supabase.from('prayer_requests').select('id, member_user_id, created_at, date, request, answered, answered_at').in('member_user_id', memberIds).order('created_at', { ascending: false })
        : { data: [] }
      const requestList = requestsRes.data ?? []

      // Fetch group prayer reactions if there are any
      const gpIds = gpList.map(gp => gp.id)
      const gpReactionsRes = gpIds.length
        ? await supabase.from('group_prayer_reactions').select('*').in('group_prayer_request_id', gpIds)
        : { data: [] }

      const reactionMap = {}
      for (const rx of reactionList) {
        if (!reactionMap[rx.prayer_request_id]) reactionMap[rx.prayer_request_id] = []
        reactionMap[rx.prayer_request_id].push(rx)
      }

      const gpReactionMap = {}
      for (const rx of gpReactionsRes.data ?? []) {
        if (!gpReactionMap[rx.group_prayer_request_id]) gpReactionMap[rx.group_prayer_request_id] = []
        gpReactionMap[rx.group_prayer_request_id].push(rx)
      }

      setMembers(profileList.map(m => ({
        ...m,
        prayer_requests: requestList.filter(r => r.member_user_id === m.user_id),
      })))
      setAllRequests(requestList)
      setAllReactions(reactionMap)
      setGroupPrayers(gpList)
      setGroupReactions(gpReactionMap)
    } finally {
      setLoading(false)
    }
  }

  const { pullDistance, refreshing, threshold } = usePullToRefresh(load, !selectedMember && !selectedGroupPrayer)

  useEffect(() => { if (groupId) load() }, [groupId])

  function handleCountChange(memberId, delta) {
    if (delta <= 0) return
    setMembers(prev => prev.map(m => {
      if (m.user_id !== memberId) return m
      const updated = [...(m.prayer_requests ?? []), { id: 'temp', created_at: new Date().toISOString() }]
      return { ...m, prayer_requests: updated }
    }))
  }

  async function toggleFeedReaction(req) {
    if (togglingIds.has(req.id)) return
    const rxs      = allReactions[req.id] ?? []
    const existing = rxs.find(r => r.user_id === userId)
    setTogglingIds(prev => new Set(prev).add(req.id))
    haptic()
    if (existing) {
      setAllReactions(prev => ({ ...prev, [req.id]: prev[req.id].filter(r => r.user_id !== userId) }))
      await supabase.from('prayer_reactions').delete().eq('id', existing.id)
    } else {
      const optimistic = {
        id: `temp-${Date.now()}`,
        prayer_request_id:       req.id,
        prayer_request_owner_id: req.member_user_id,
        community_group_id:      groupId,
        user_id:                 userId,
        display_name:            displayName,
        avatar_icon:             avatarIcon    ?? null,
        avatar_color:            avatarColorKey ?? null,
        avatar_image_url:        avatarImageUrl ?? null,
      }
      setAllReactions(prev => ({ ...prev, [req.id]: [...(prev[req.id] ?? []), optimistic] }))
      const { data, error: err } = await supabase
        .from('prayer_reactions')
        .insert({
          prayer_request_id:       req.id,
          prayer_request_owner_id: req.member_user_id,
          community_group_id:      groupId,
          user_id:                 userId,
          display_name:            displayName,
          avatar_icon:             avatarIcon    ?? null,
          avatar_color:            avatarColorKey ?? null,
          avatar_image_url:        avatarImageUrl ?? null,
        })
        .select()
        .maybeSingle()
      if (err) {
        setAllReactions(prev => ({ ...prev, [req.id]: prev[req.id].filter(r => r.id !== optimistic.id) }))
      } else if (data) {
        setAllReactions(prev => ({ ...prev, [req.id]: prev[req.id].map(r => r.id === optimistic.id ? data : r) }))
      }
    }
    setTogglingIds(prev => { const s = new Set(prev); s.delete(req.id); return s })
  }

  async function toggleGroupReaction(gp) {
    if (togglingIds.has(gp.id)) return
    const rxs      = groupReactions[gp.id] ?? []
    const existing = rxs.find(r => r.user_id === userId)
    setTogglingIds(prev => new Set(prev).add(gp.id))
    haptic()
    if (existing) {
      setGroupReactions(prev => ({ ...prev, [gp.id]: prev[gp.id].filter(r => r.user_id !== userId) }))
      await supabase.from('group_prayer_reactions').delete().eq('id', existing.id)
    } else {
      const optimistic = {
        id: `temp-${Date.now()}`,
        group_prayer_request_id: gp.id,
        community_group_id:      groupId,
        user_id:                 userId,
        display_name:            displayName,
        avatar_icon:             avatarIcon    ?? null,
        avatar_color:            avatarColorKey ?? null,
        avatar_image_url:        avatarImageUrl ?? null,
      }
      setGroupReactions(prev => ({ ...prev, [gp.id]: [...(prev[gp.id] ?? []), optimistic] }))
      const { data, error: err } = await supabase
        .from('group_prayer_reactions')
        .insert({
          group_prayer_request_id: gp.id,
          community_group_id:      groupId,
          user_id:                 userId,
          display_name:            displayName,
          avatar_icon:             avatarIcon    ?? null,
          avatar_color:            avatarColorKey ?? null,
          avatar_image_url:        avatarImageUrl ?? null,
        })
        .select()
        .maybeSingle()
      if (err) {
        setGroupReactions(prev => ({ ...prev, [gp.id]: prev[gp.id].filter(r => r.id !== optimistic.id) }))
      } else if (data) {
        setGroupReactions(prev => ({ ...prev, [gp.id]: prev[gp.id].map(r => r.id === optimistic.id ? data : r) }))
      }
    }
    setTogglingIds(prev => { const s = new Set(prev); s.delete(gp.id); return s })
  }

  async function handleCreateGroupPrayer() {
    if (selectedMemberIds.size < 2 || !requestText.trim() || creating) return
    setCreating(true)
    const { data, error: err } = await supabase
      .from('group_prayer_requests')
      .insert({
        member_user_ids: Array.from(selectedMemberIds),
        request:         requestText.trim(),
        added_by:        displayName,
        created_by:      userId,
        community_group_id: groupId,
      })
      .select()
      .single()
    if (err) { toast('Failed to save prayer request', 'error'); setCreating(false); return }
    setGroupPrayers(prev => [data, ...prev])
    setCreating(false)
    closeCreate()
    setSelectedMemberIds(new Set())
    setRequestText('')
  }

  function openCreate() {
    resetCreate()
    setSelectedMemberIds(new Set())
    setRequestText('')
    setShowCreate(true)
  }

  function toggleMember(id) {
    setSelectedMemberIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ─── Derived lists ───────────────────────────────────────────────────────────

  const memberMap = Object.fromEntries(members.map(m => [m.user_id, m]))

  const feedItems = allRequests
    .filter(r => !r.answered)
    .map(r => ({ ...r, member: memberMap[r.member_user_id] }))
    .filter(r => r.member)

  const q = searchQuery.trim().toLowerCase()

  // Members view: combine members + active group prayers, sorted by recency
  const filteredGroupPrayers = groupPrayers.filter(gp =>
    !gp.answered && (!q ||
      gp.request?.toLowerCase().includes(q) ||
      gp.member_user_ids.some(id => memberMap[id]?.display_name?.toLowerCase().includes(q))
    )
  )
  const filteredMembers = q
    ? members.filter(m => m.display_name?.toLowerCase().includes(q))
    : members

  const combinedList = [
    ...filteredMembers.map(m => ({
      type: 'member',
      data: m,
      sortKey: m.prayer_requests?.[0]?.created_at ?? null,
    })),
    ...filteredGroupPrayers.map(gp => ({
      type: 'group',
      data: gp,
      sortKey: gp.created_at,
    })),
  ].sort((a, b) => {
    if (!a.sortKey && !b.sortKey) return 0
    if (!a.sortKey) return 1
    if (!b.sortKey) return -1
    return new Date(b.sortKey) - new Date(a.sortKey)
  })

  // Feed view: combine individual + group requests, sorted by created_at desc
  const allFeedItems = [
    ...feedItems.map(r => ({ type: 'individual', data: r, sortKey: r.created_at })),
    ...groupPrayers.filter(gp => !gp.answered).map(gp => ({ type: 'group', data: gp, sortKey: gp.created_at })),
  ].sort((a, b) => new Date(b.sortKey) - new Date(a.sortKey))

  const filteredFeed = q
    ? allFeedItems.filter(item => {
        if (item.type === 'individual') {
          return item.data.request?.toLowerCase().includes(q) ||
            item.data.member?.display_name?.toLowerCase().includes(q)
        }
        return item.data.request?.toLowerCase().includes(q) ||
          item.data.member_user_ids.some(id => memberMap[id]?.display_name?.toLowerCase().includes(q))
      })
    : allFeedItems

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <main className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12">
      {pullDistance > 0 && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center transition-transform"
          style={{ top: 'calc(env(safe-area-inset-top) + 8px)', transform: `translateY(${Math.min(pullDistance, threshold) * 0.6}px)` }}
        >
          <div className={`w-8 h-8 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            <div className="w-3 h-3 rounded-full border-2 border-ember border-t-transparent" style={{ opacity: pullDistance / threshold }} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-stone-800">Prayer Requests</h1>
        {!loading && members.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const opening = !searchOpen
                setSearchOpen(opening)
                if (!opening) setSearchQuery('')
                else setTimeout(() => searchInputRef.current?.focus(), 50)
              }}
              aria-label="Search"
              className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${searchOpen ? 'bg-ember text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-ember'}`}
            >
              <MagnifyingGlass size={20} weight={searchOpen ? 'fill' : 'regular'} />
            </button>
            <button
              onClick={openCreate}
              aria-label="Shared prayer request"
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-ember transition-colors"
            >
              <Users size={20} weight="bold" />
            </button>
          </div>
        )}
      </div>

      {/* View toggle */}
      {!loading && members.length > 0 && (
        <LayoutGroup id="prayer-tabs">
          <div className="flex bg-stone-100 rounded-xl p-1 mb-4">
            <button
              onClick={() => switchViewMode('members')}
              className={`flex-1 relative py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'members' ? 'text-white' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {viewMode === 'members' && (
                <motion.span
                  layoutId="prayer-pill"
                  className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">Friends</span>
            </button>
            <button
              onClick={() => switchViewMode('feed')}
              className={`flex-1 relative py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'feed' ? 'text-white' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {viewMode === 'feed' && (
                <motion.span
                  layoutId="prayer-pill"
                  className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">Requests</span>
            </button>
          </div>
        </LayoutGroup>
      )}

      {/* Search */}
      <motion.div
        initial={false}
        animate={{
          height: searchOpen ? 'auto' : 0,
          opacity: searchOpen ? 1 : 0,
          marginBottom: searchOpen ? 16 : 0,
        }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ overflow: 'hidden', padding: '2px', margin: '-2px' }}
      >
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={viewMode === 'members' ? 'Search friends…' : 'Search requests…'}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
          />
          {searchQuery && (
            <button
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </motion.div>

      {/* Content */}
      <div key={viewMode} className={contentAnimClass}>
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-stone-100 rounded-2xl p-4 animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
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
        <div className="text-center py-16 text-stone-500">
          <div className="flex justify-center mb-3">
            <HandsPraying size={48} weight="fill" className="text-stone-300" />
          </div>
          <p className="text-sm">No members in this group yet</p>
        </div>
      ) : viewMode === 'members' ? (
        combinedList.length === 0 ? (
          <div className="text-center py-12 text-stone-500">
            <MagnifyingGlass size={40} className="mx-auto mb-2 text-stone-300" />
            <p className="text-sm">No members match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="space-y-2">
            {combinedList.map((item, i) =>
              item.type === 'member' ? (
                <MemberCard
                  key={item.data.user_id}
                  member={item.data}
                  index={i}
                  onClick={() => setSelectedMember(item.data)}
                />
              ) : (
                <GroupPrayerCard
                  key={item.data.id}
                  groupPrayer={item.data}
                  memberMap={memberMap}
                  index={i}
                  onClick={() => setSelectedGroupPrayer(item.data)}
                />
              )
            )}
          </div>
        )
      ) : (
        filteredFeed.length === 0 ? (
          <div className="text-center py-12 text-stone-500">
            {q ? (
              <>
                <MagnifyingGlass size={40} className="mx-auto mb-2 text-stone-300" />
                <p className="text-sm">No requests match "{searchQuery}"</p>
              </>
            ) : (
              <>
                <HandsPraying size={48} weight="fill" className="mx-auto mb-3 text-stone-300" />
                <p className="text-sm">No active prayer requests</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFeed.map((item, i) =>
              item.type === 'individual' ? (
                <FeedCard
                  key={item.data.id}
                  req={item.data}
                  member={item.data.member}
                  reactions={allReactions[item.data.id]}
                  currentUserId={userId}
                  isOwnRequest={item.data.member_user_id === userId}
                  toggling={togglingIds.has(item.data.id)}
                  onPray={() => toggleFeedReaction(item.data)}
                  onOpen={() => setSelectedMember(item.data.member)}
                  index={i}
                />
              ) : (
                <GroupFeedCard
                  key={item.data.id}
                  groupPrayer={item.data}
                  memberMap={memberMap}
                  reactions={groupReactions[item.data.id]}
                  currentUserId={userId}
                  toggling={togglingIds.has(item.data.id)}
                  onPray={() => toggleGroupReaction(item.data)}
                  onOpen={() => setSelectedGroupPrayer(item.data)}
                  index={i}
                />
              )
            )}
          </div>
        )
      )}
      </div>

      {/* Individual member profile */}
      {selectedMember && (
        <PrayerProfile
          member={selectedMember}
          displayName={displayName}
          groupId={groupId}
          currentUserId={userId}
          currentAvatarIcon={avatarIcon}
          currentAvatarColor={avatarColorKey}
          currentAvatarImageUrl={avatarImageUrl}
          onClose={() => { setSelectedMember(null); load() }}
          onCountChange={handleCountChange}
        />
      )}

      {/* Group prayer profile */}
      {selectedGroupPrayer && (
        <GroupPrayerProfile
          groupPrayer={selectedGroupPrayer}
          memberProfiles={selectedGroupPrayer.member_user_ids.map(id => memberMap[id]).filter(Boolean)}
          displayName={displayName}
          groupId={groupId}
          currentUserId={userId}
          isAdmin={isAdmin}
          currentAvatarIcon={avatarIcon}
          currentAvatarColor={avatarColorKey}
          currentAvatarImageUrl={avatarImageUrl}
          onClose={() => { setSelectedGroupPrayer(null); load() }}
          onUpdate={updated => {
            if (updated._deleted) {
              setGroupPrayers(prev => prev.filter(gp => gp.id !== updated.id))
              // Don't unmount here — let handleClose() play the slide-out animation first
            } else {
              setGroupPrayers(prev => prev.map(gp => gp.id === updated.id ? updated : gp))
              setSelectedGroupPrayer(updated)
            }
          }}
        />
      )}

      {/* Group prayer creation sheet */}
      {showCreate && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end lg:items-center lg:justify-center z-50 ${createClosing ? 'animate-backdrop-out' : 'animate-overlay-in'}`}
          onClick={closeCreate}
        >
          <div
            className={`bg-white rounded-t-2xl lg:rounded-2xl w-full max-w-lg mx-auto ${createClosing ? 'animate-sheet-out' : 'animate-modal-in'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <h2 className="text-lg font-bold text-stone-800">Shared Prayer Request</h2>
              <button onClick={closeCreate} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors text-stone-400 hover:text-stone-600">
                <X size={20} />
              </button>
            </div>

            {/* Member selection */}
            <div className="px-5 pb-3">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                Select members
                {selectedMemberIds.size > 0 && (
                  <span className="ml-2 text-ember normal-case font-semibold">
                    {selectedMemberIds.size} selected
                  </span>
                )}
              </p>
              <div className="space-y-0.5 max-h-48 overflow-y-auto">
                {members.map(m => {
                  const selected = selectedMemberIds.has(m.user_id)
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => toggleMember(m.user_id)}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-stone-50 transition-colors"
                    >
                      <AvatarCircle size="sm" icon={m.avatar_icon} colorKey={m.avatar_color} userId={m.user_id} name={m.display_name} imageUrl={m.avatar_image_url} />
                      <span className="flex-1 text-sm font-medium text-stone-800 text-left">{m.display_name}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-ember border-ember' : 'border-stone-300'}`}>
                        {selected && <Check size={11} weight="bold" className="text-white" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Request textarea */}
            <div className="px-5 pb-4">
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Prayer request</p>
              <textarea
                value={requestText}
                onChange={e => setRequestText(e.target.value)}
                placeholder="What would you like the group to pray for?"
                rows={3}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent resize-none"
              />
            </div>

            {/* Submit */}
            <div className="px-5 pb-8">
              <button
                onClick={handleCreateGroupPrayer}
                disabled={creating || selectedMemberIds.size < 2 || !requestText.trim()}
                className="w-full py-3 rounded-xl bg-ember text-white font-semibold text-sm hover:bg-ember-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? 'Saving…' : selectedMemberIds.size < 2 ? 'Select at least 2 members' : 'Add Shared Prayer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
