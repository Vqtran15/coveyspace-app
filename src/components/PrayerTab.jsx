import { useState, useEffect } from 'react'
import { HandsPraying, X, Plus, Trash } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function AddFriendModal({ onClose, onSave }) {
  const [closing, close] = useModalClose(onClose)
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(name.trim())
    } catch (err) {
      setError(err.message ?? 'Could not save.')
      setSaving(false)
    }
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4">
          <h2 className="text-xl font-bold text-stone-800">Add a Friend</h2>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
              required
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={close}
              className="flex-1 py-2 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-jade hover:bg-jade-700 text-white rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PrayerModal({ friend, onClose, onFriendDelete, onCountChange }) {
  const [closing, close] = useModalClose(onClose)
  const [requests, setRequests]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [date, setDate]                   = useState(new Date().toISOString().split('T')[0])
  const [requestText, setRequestText]     = useState('')
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting]           = useState(false)

  useEffect(() => {
    supabase
      .from('prayer_requests')
      .select('*')
      .eq('friend_id', friend.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRequests(data ?? [])
        setLoading(false)
      })
  }, [friend.id])

  async function handleAdd(e) {
    e.preventDefault()
    if (!requestText.trim()) return
    setSaving(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('prayer_requests')
      .insert({ friend_id: friend.id, date, request: requestText.trim() })
      .select()
      .single()
    if (err) { setError(err.message); setSaving(false); return }
    setRequests(prev => [data, ...prev])
    setRequestText('')
    setDate(new Date().toISOString().split('T')[0])
    setSaving(false)
    onCountChange(friend.id, +1)
  }

  async function handleDeleteRequest(id) {
    const { error: err } = await supabase.from('prayer_requests').delete().eq('id', id)
    if (!err) {
      setRequests(prev => prev.filter(r => r.id !== id))
      onCountChange(friend.id, -1)
    }
  }

  async function handleDeleteFriend() {
    setDeleting(true)
    const { error: err } = await supabase.from('prayer_friends').delete().eq('id', friend.id)
    if (err) { setDeleting(false); return }
    onFriendDelete(friend.id)
    onClose()
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[90vh] ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="text-xl font-bold text-stone-800">{friend.name}</h2>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6">
          {/* Add request form */}
          <form onSubmit={handleAdd} className="space-y-3 pb-5 border-b border-stone-100">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent text-sm"
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
            {loading ? (
              <p className="text-sm text-stone-400 text-center animate-pulse py-4">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">No requests yet. Add one above!</p>
            ) : (
              requests.map(r => (
                <div key={r.id} className="bg-stone-50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs text-stone-400">{formatDate(r.date)}</span>
                    <button
                      onClick={() => handleDeleteRequest(r.id)}
                      className="shrink-0 text-stone-300 hover:text-red-500 active:text-red-600 transition-colors p-0.5"
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                  <p className="text-sm text-stone-700 leading-relaxed">{r.request}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Remove friend footer */}
        <div className="px-6 pb-6 pt-3 border-t border-stone-100 shrink-0">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
            >
              Remove Friend
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="text-sm text-red-700 flex-1">Remove {friend.name}?</span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="text-sm text-stone-500 hover:text-stone-700 font-medium px-3 py-2.5 min-h-[44px] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFriend}
                disabled={deleting}
                className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-4 py-2.5 min-h-[44px] rounded-lg disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Removing…' : 'Remove'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FriendCard({ friend, index, onClick }) {
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation('/prayer', index)
  const count = friend.prayer_requests?.length ?? 0

  return (
    <button
      onClick={onClick}
      style={entranceStyle}
      className={`w-full text-left p-4 rounded-xl bg-white border-2 border-stone-200 hover:border-jade/40 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-jade ${entranceClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-jade/10 flex items-center justify-center text-jade font-bold text-sm shrink-0">
            {friend.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-stone-800">{friend.name}</span>
        </div>
        <span className="text-xs text-stone-400 shrink-0">
          {count === 0 ? 'No requests' : `${count} request${count !== 1 ? 's' : ''}`}
        </span>
      </div>
    </button>
  )
}

export default function PrayerTab() {
  const [friends, setFriends]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [addOpen, setAddOpen]           = useState(false)
  const [selectedFriend, setSelectedFriend] = useState(null)

  useEffect(() => {
    supabase
      .from('prayer_friends')
      .select('*, prayer_requests(id)')
      .order('name')
      .then(({ data }) => {
        setFriends(data ?? [])
        setLoading(false)
      })
  }, [])

  async function handleAddFriend(name) {
    const { data, error } = await supabase
      .from('prayer_friends')
      .insert({ name })
      .select('*, prayer_requests(id)')
      .single()
    if (error) throw new Error(error.message)
    setFriends(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setAddOpen(false)
  }

  function handleFriendDelete(id) {
    setFriends(prev => prev.filter(f => f.id !== id))
    setSelectedFriend(null)
  }

  function handleCountChange(friendId, delta) {
    setFriends(prev => prev.map(f => {
      if (f.id !== friendId) return f
      const updated = delta > 0
        ? [...(f.prayer_requests ?? []), { id: 'temp' }]
        : (f.prayer_requests ?? []).slice(1)
      return { ...f, prayer_requests: updated }
    }))
  }

  return (
    <main className="max-w-3xl mx-auto px-4 pt-8 pb-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Prayer Requests</h1>
          <p className="text-stone-500 mt-1 text-sm">
            {!loading && (friends.length === 0
              ? 'No friends added yet'
              : `${friends.length} friend${friends.length !== 1 ? 's' : ''}`
            )}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Add a Friend
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-stone-400 text-sm animate-pulse">Loading…</div>
      ) : friends.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <div className="flex justify-center mb-3">
            <HandsPraying size={48} weight="fill" className="text-stone-300" />
          </div>
          <p className="text-sm">Add a friend to keep track of prayer requests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((friend, i) => (
            <FriendCard
              key={friend.id}
              friend={friend}
              index={i}
              onClick={() => setSelectedFriend(friend)}
            />
          ))}
        </div>
      )}

      {addOpen && (
        <AddFriendModal onClose={() => setAddOpen(false)} onSave={handleAddFriend} />
      )}

      {selectedFriend && (
        <PrayerModal
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onFriendDelete={handleFriendDelete}
          onCountChange={handleCountChange}
        />
      )}
    </main>
  )
}
