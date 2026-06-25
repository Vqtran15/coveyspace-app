import { useState, useEffect, useRef } from 'react'
import { HandsPraying, X, Plus, Trash, PencilSimple, Check, MagnifyingGlass } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import { useToast } from '../lib/toast.jsx'
import { haptic } from '../lib/haptic.js'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'

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

function PrayerModal({ member, displayName, onClose, onCountChange }) {
  const [closing, close] = useModalClose(onClose)
  const toast = useToast()
  const [requests, setRequests]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [animDone, setAnimDone]           = useState(false)
  const [date, setDate]                   = useState(new Date().toISOString().split('T')[0])
  const [requestText, setRequestText]     = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)
  const [editingId, setEditingId]         = useState(null)
  const [editDate, setEditDate]           = useState('')
  const [editText, setEditText]           = useState('')
  const [newId, setNewId]                 = useState(null)
  const newIdTimerRef                     = useRef(null)
  const [confirmRequestId, setConfirmRequestId] = useState(null)

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
    setRequests(prev => [data, ...prev])
    setNewId(data.id)
    clearTimeout(newIdTimerRef.current)
    newIdTimerRef.current = setTimeout(() => setNewId(null), 500)
    setRequestText('')
    setDate(new Date().toISOString().split('T')[0])
    setSaving(false)
    haptic()
    onCountChange(member.user_id, +1)
  }

  async function handleDeleteRequest(id) {
    const { error: err } = await supabase.from('prayer_requests').delete().eq('id', id)
    if (err) { toast('Failed to delete: ' + err.message, 'error'); return }
    setRequests(prev => prev.filter(r => r.id !== id))
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

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end z-50 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-t-2xl shadow-xl w-full flex flex-col max-h-[90vh] ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-full ${avatarColor(member.user_id, member.avatar_color)} flex items-center justify-center shrink-0`}>
              {member.avatar_icon
                ? <AvatarIcon name={member.avatar_icon} size={16} />
                : <span className="text-white font-bold text-sm">{(member.display_name ?? '?').charAt(0).toUpperCase()}</span>
              }
            </div>
            <h2 className="text-xl font-bold text-stone-800 truncate">{member.display_name}</h2>
          </div>
          <button
            onClick={close}
            className="shrink-0 text-stone-400 hover:text-stone-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto min-h-0 px-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {/* Add request form */}
          <form onSubmit={handleAdd} className="space-y-3 pb-5 border-b border-stone-100">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full appearance-none border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Prayer Request</label>
              <textarea
                value={requestText}
                onChange={e => setRequestText(e.target.value)}
                placeholder="Write a prayer request…"
                rows={3}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent text-sm resize-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <button
              type="submit"
              disabled={saving || !requestText.trim()}
              className="w-full py-2.5 bg-jade hover:bg-jade-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <Plus size={16} weight="bold" />
              {saving ? 'Adding…' : 'Add Request'}
            </button>
          </form>

          {/* Prayer request list */}
          <div className="py-4 space-y-3">
            {loading || !animDone ? (
              <div className="space-y-3">
                {[0, 1, 2].map(i => (
                  <div key={i} className="bg-stone-50 rounded-xl p-3 animate-pulse" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="h-3 bg-stone-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-stone-200 rounded w-full mb-1.5" />
                    <div className="h-3 bg-stone-200 rounded w-4/5" />
                  </div>
                ))}
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">No requests yet. Add one above!</p>
            ) : (
              requests.map(r => (
                <div key={r.id} className={`bg-stone-50 rounded-xl p-3 ${newId === r.id ? 'animate-fade-up' : ''}`}>
                  {editingId === r.id ? (
                    <form onSubmit={handleSaveRequest} className="space-y-2">
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="w-full appearance-none border border-stone-300 rounded-lg px-3 py-1.5 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent text-sm"
                      />
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={3}
                        className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent text-sm resize-none"
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
                          className="flex-1 py-1.5 bg-jade hover:bg-jade-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <span className="text-xs text-stone-400">{formatDate(r.date)}</span>
                          {r.added_by && (
                            <span className="text-xs text-stone-400"> · {r.added_by}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setConfirmRequestId(null); startEditRequest(r) }}
                            className="text-stone-300 hover:text-stone-500 transition-colors p-0.5"
                          >
                            <PencilSimple size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmRequestId(r.id)}
                            className="text-stone-300 hover:text-red-500 active:text-red-600 transition-colors p-0.5"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-stone-700 leading-relaxed">{r.request}</p>
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
              ))
            )}
          </div>
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
      className={`w-full text-left p-4 rounded-xl bg-white border-2 border-stone-200 hover:border-jade/40 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-jade ${entranceClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${avatarColor(member.user_id, member.avatar_color)} flex items-center justify-center shrink-0`}>
            {member.avatar_icon
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

export default function PrayerTab({ displayName, groupId, isAdmin, onOpenSettings }) {
  const [members, setMembers]               = useState([])
  const [loading, setLoading]               = useState(true)
  const [selectedMember, setSelectedMember] = useState(null)
  const [searchQuery, setSearchQuery]       = useState('')

  async function load() {
    if (!groupId) return
    const [membersRes, requestsRes] = await Promise.all([
      supabase.from('profiles').select('user_id, display_name, avatar_icon, avatar_color').eq('community_group_id', groupId).order('display_name'),
      supabase.from('prayer_requests').select('id, member_user_id, created_at'),
    ])
    const profileList = membersRes.data ?? []
    const requestList = requestsRes.data ?? []
    setMembers(profileList.map(m => ({
      ...m,
      prayer_requests: requestList.filter(r => r.member_user_id === m.user_id),
    })))
    setLoading(false)
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
    <main className="max-w-3xl mx-auto px-4 pt-8 pb-12">
      {/* Pull-to-refresh indicator */}
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

      {/* Search bar */}
      {!loading && members.length > 0 && (
        <div className="relative mb-4">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search members…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
          />
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
          <MagnifyingGlass size={32} className="mx-auto mb-2 text-stone-300" />
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
          onClose={() => setSelectedMember(null)}
          onCountChange={handleCountChange}
        />
      )}
    </main>
  )
}
