import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { HandsPraying, MagnifyingGlass, X } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { AvatarCircle } from '../lib/avatarIcons.jsx'
import { haptic } from '../lib/haptic.js'
import PrayerProfile from './PrayerProfile.jsx'

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
  const d = new Date(dateStr)
  const diffDays = Math.floor((Date.now() - d) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)  return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function MemberCard({ member, index, onClick }) {
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation('/prayer', index)
  const lastUpdated = formatLastUpdated(member.prayer_requests)

  return (
    <button
      onClick={onClick}
      style={entranceStyle}
      className={`w-full text-left p-4 rounded-xl bg-white border-2 border-stone-200 hover:border-jade/40 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-jade ${entranceClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AvatarCircle size="md" icon={member.avatar_icon} colorKey={member.avatar_color} userId={member.user_id} name={member.display_name} imageUrl={member.avatar_image_url} />
          <div className="font-semibold text-stone-800">{member.display_name}</div>
        </div>
        {lastUpdated && (
          <span className="text-xs text-stone-400 shrink-0">{lastUpdated}</span>
        )}
      </div>
    </button>
  )
}

function FeedCard({ req, member, reactions, currentUserId, isOwnRequest, toggling, onPray, onOpen, index }) {
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation('/prayer', index)
  const reactionCount = reactions?.length ?? 0
  const userReacted   = reactions?.some(r => r.user_id === currentUserId) ?? false

  return (
    <div style={entranceStyle} className={`bg-white border-2 border-stone-200 rounded-xl p-4 shadow-sm ${entranceClass}`}>
      <div className="flex items-center justify-between mb-2.5">
        <button onClick={onOpen} className="flex items-center gap-2 min-w-0">
          <AvatarCircle size="8" icon={member?.avatar_icon} colorKey={member?.avatar_color} userId={member?.user_id} name={member?.display_name} imageUrl={member?.avatar_image_url} />
          <span className="text-sm font-semibold text-stone-700 truncate">{member?.display_name}</span>
        </button>
        <span className="text-xs text-stone-400 shrink-0 ml-2">{formatRelativeDate(req.created_at)}</span>
      </div>

      <button onClick={onOpen} className="w-full text-left">
        <p className="text-sm text-stone-700 leading-relaxed line-clamp-3">{req.request}</p>
      </button>

      <div className="flex justify-end mt-3 pt-2.5 border-t border-stone-100">
        {isOwnRequest ? (
          reactionCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-stone-500">
              <HandsPraying size={16} weight="fill" className="text-jade" />
              <span className="font-medium text-jade">{reactionCount}</span>
              <span>{reactionCount === 1 ? 'person praying' : 'people praying'}</span>
            </span>
          )
        ) : (
          <button
            onClick={onPray}
            disabled={toggling}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              userReacted
                ? 'bg-jade/10 text-jade'
                : 'text-stone-400 hover:bg-stone-100 hover:text-stone-600'
            }`}
          >
            <HandsPraying size={16} weight={userReacted ? 'fill' : 'regular'} />
            {reactionCount > 0 && <span>{reactionCount}</span>}
            <span>{userReacted ? 'Praying' : 'Pray'}</span>
          </button>
        )}
      </div>
    </div>
  )
}

export default function PrayerTab({ displayName, groupId, isAdmin, onOpenSettings, userId, avatarIcon, avatarColorKey, avatarImageUrl }) {
  const location = useLocation()
  const featuredUserId = location.state?.featuredUserId
  const [members, setMembers]           = useState([])
  const [allRequests, setAllRequests]   = useState([])
  const [allReactions, setAllReactions] = useState({})
  const [loading, setLoading]           = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [viewMode, setViewMode]         = useState('members')
  const [togglingIds, setTogglingIds]   = useState(new Set())

  useEffect(() => {
    if (!featuredUserId || members.length === 0 || selectedMember) return
    const featured = members.find(m => m.user_id === featuredUserId)
    if (featured) setSelectedMember(featured)
  }, [members, featuredUserId])

  async function load() {
    if (!groupId) return
    try {
      const [membersRes, requestsRes, reactionsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name, avatar_icon, avatar_color, avatar_image_url').eq('community_group_id', groupId).order('display_name'),
        supabase.from('prayer_requests').select('id, member_user_id, created_at, date, request, answered').order('created_at', { ascending: false }),
        supabase.from('prayer_reactions').select('id, prayer_request_id, user_id, display_name, avatar_icon, avatar_color, avatar_image_url, prayer_request_owner_id, community_group_id').eq('community_group_id', groupId),
      ])
      const profileList  = membersRes.data  ?? []
      const requestList  = requestsRes.data ?? []
      const reactionList = reactionsRes.data ?? []

      const reactionMap = {}
      for (const rx of reactionList) {
        if (!reactionMap[rx.prayer_request_id]) reactionMap[rx.prayer_request_id] = []
        reactionMap[rx.prayer_request_id].push(rx)
      }

      setMembers(profileList.map(m => ({
        ...m,
        prayer_requests: requestList.filter(r => r.member_user_id === m.user_id),
      })))
      setAllRequests(requestList)
      setAllReactions(reactionMap)
    } finally {
      setLoading(false)
    }
  }

  const { pullDistance, refreshing, threshold } = usePullToRefresh(load, !selectedMember)

  useEffect(() => { if (groupId) load() }, [groupId])

  function handleCountChange(memberId, delta) {
    setMembers(prev => prev.map(m => {
      if (m.user_id !== memberId) return m
      const updated = delta > 0
        ? [...(m.prayer_requests ?? []), { id: 'temp', created_at: new Date().toISOString() }]
        : (m.prayer_requests ?? []).slice(1)
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

  const memberMap = Object.fromEntries(members.map(m => [m.user_id, m]))
  const feedItems = allRequests
    .filter(r => !r.answered)
    .map(r => ({ ...r, member: memberMap[r.member_user_id] }))
    .filter(r => r.member)

  const q = searchQuery.trim().toLowerCase()
  const filteredMembers = q
    ? members.filter(m => m.display_name?.toLowerCase().includes(q))
    : members
  const filteredFeed = q
    ? feedItems.filter(r =>
        r.request?.toLowerCase().includes(q) ||
        r.member?.display_name?.toLowerCase().includes(q)
      )
    : feedItems

  return (
    <main className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12">
      {pullDistance > 0 && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center transition-transform"
          style={{ top: 'calc(env(safe-area-inset-top) + 8px)', transform: `translateY(${Math.min(pullDistance, threshold) * 0.6}px)` }}
        >
          <div className={`w-8 h-8 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            <div className="w-3 h-3 rounded-full border-2 border-jade border-t-transparent" style={{ opacity: pullDistance / threshold }} />
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-stone-800">Prayer Requests</h1>
        <p className="text-stone-500 mt-1 text-sm">
          {!loading && (members.length === 0
            ? 'No members yet'
            : `${members.length} member${members.length !== 1 ? 's' : ''}`
          )}
        </p>
      </div>

      {/* View toggle */}
      {!loading && members.length > 0 && (
        <div className="flex bg-stone-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setViewMode('members')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'members' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Members
          </button>
          <button
            onClick={() => setViewMode('feed')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${viewMode === 'feed' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Requests
          </button>
        </div>
      )}

      {/* Search */}
      {!loading && members.length > 0 && (
        <div className="relative mb-4">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={viewMode === 'members' ? 'Search members…' : 'Search requests…'}
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
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
      ) : viewMode === 'members' ? (
        filteredMembers.length === 0 ? (
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
        )
      ) : (
        filteredFeed.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
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
            {filteredFeed.map((req, i) => (
              <FeedCard
                key={req.id}
                req={req}
                member={req.member}
                reactions={allReactions[req.id]}
                currentUserId={userId}
                isOwnRequest={req.member_user_id === userId}
                toggling={togglingIds.has(req.id)}
                onPray={() => toggleFeedReaction(req)}
                onOpen={() => setSelectedMember(req.member)}
                index={i}
              />
            ))}
          </div>
        )
      )}

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
    </main>
  )
}
