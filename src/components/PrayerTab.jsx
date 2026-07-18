import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { HandsPraying, MagnifyingGlass, X } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { AvatarCircle } from '../lib/avatarIcons.jsx'
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
        <PrayerProfile
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
