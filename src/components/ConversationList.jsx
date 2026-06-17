import { useState, useEffect } from 'react'
import { ChatCircleDots, NotePencil, PencilSimple, Users } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import NotesModal from './NotesModal.jsx'

const AVATAR_COLORS = ['bg-jade', 'bg-coral', 'bg-lagoon-700']
function avatarColor(userId) {
  const n = (userId?.charCodeAt(0) ?? 0) + (userId?.charCodeAt(userId.length - 1) ?? 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ConversationList({ session, groupId, members, onSelect, onRead }) {
  const [conversations, setConversations] = useState([])
  const [lastMessages, setLastMessages]   = useState({})
  const [loading, setLoading]             = useState(true)
  const [newDmOpen, setNewDmOpen]         = useState(false)
  const [notesOpen, setNotesOpen]         = useState(false)
  const [starting, setStarting]           = useState(false)

  const myId = session.user.id
  const { className: headerClass } = useEntranceAnimation('/chat', 0, { direction: 'left' })

  async function loadConversations() {
    try {
      const { data: convs, error } = await supabase
        .from('conversations')
        .select('*, conversation_members(user_id)')
        .order('updated_at', { ascending: false })

if (error) throw error
      if (!convs?.length) return

      setConversations(convs)

      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, body, display_name, image_url, created_at')
        .in('conversation_id', convs.map(c => c.id))
        .order('created_at', { ascending: false })
        .limit(200)

      const map = {}
      for (const msg of msgs ?? []) {
        if (!map[msg.conversation_id]) map[msg.conversation_id] = msg
      }
      setLastMessages(map)
    } catch (err) {
      console.error('loadConversations:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!groupId) {
      setLoading(false)
      return
    }
    setLoading(true)
    onRead?.()
    loadConversations()

    const ch = supabase
      .channel(`conv-list:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `community_group_id=eq.${groupId}`,
      }, ({ new: msg }) => {
        setLastMessages(prev => ({
          ...prev,
          [msg.conversation_id]: prev[msg.conversation_id]?.created_at > msg.created_at
            ? prev[msg.conversation_id]
            : msg,
        }))
        setConversations(prev =>
          [...prev.map(c => c.id === msg.conversation_id ? { ...c, updated_at: msg.created_at } : c)]
            .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        )
      })
      .subscribe()

    return () => supabase.removeChannel(ch)
  }, [groupId])

  function convName(conv) {
    if (conv.type === 'group') return conv.name || 'Group Chat'
    const otherId = conv.conversation_members?.find(m => m.user_id !== myId)?.user_id
    return members.find(m => m.user_id === otherId)?.display_name || 'Direct Message'
  }

  function lastPreview(conv) {
    const msg = lastMessages[conv.id]
    if (!msg) return 'No messages yet'
    if (msg.image_url && !msg.body) return '📷 Photo'
    if (msg.image_url) return `📷 ${msg.body}`
    return msg.body || ''
  }

  async function startDm(otherId) {
    setStarting(true)
    const { data: convId, error } = await supabase.rpc('find_or_create_dm', { other_user_id: otherId })
    if (error || !convId) { setStarting(false); return }

    const existing = conversations.find(c => c.id === convId)
    if (existing) {
      setNewDmOpen(false)
      setStarting(false)
      onSelect(existing)
      return
    }

    const { data: conv } = await supabase
      .from('conversations')
      .select('*, conversation_members(user_id)')
      .eq('id', convId)
      .single()

    setNewDmOpen(false)
    setStarting(false)
    if (conv) {
      setConversations(prev => [conv, ...prev])
      onSelect(conv)
    }
  }

  const otherMembers = members.filter(m => m.user_id !== myId)

  return (
    <div
      className="flex flex-col bg-sunrise-50"
      style={{ height: 'calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 62px)' }}
    >
      {/* Header */}
      <div className={`max-w-3xl mx-auto w-full px-4 pt-6 pb-3 shrink-0 flex items-center justify-between ${headerClass}`}>
        <div className="flex items-center gap-3">
          <ChatCircleDots size={32} weight="fill" className="text-jade shrink-0" />
          <h1 className="text-3xl font-bold text-stone-800">Chat</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNotesOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <NotePencil size={20} />
          </button>
          <button
            onClick={() => setNewDmOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <PencilSimple size={20} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <p className="text-stone-400 text-sm animate-pulse">Loading…</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-stone-400">
            <ChatCircleDots size={48} weight="fill" className="text-stone-300 mb-3" />
            <p className="text-sm">No conversations yet</p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full divide-y divide-stone-100">
            {conversations.map(conv => {
              const name = convName(conv)
              const isDm = conv.type === 'direct'
              const otherId = isDm
                ? conv.conversation_members?.find(m => m.user_id !== myId)?.user_id
                : null
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/70 transition-colors text-left"
                >
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${isDm ? avatarColor(otherId ?? '') : 'bg-jade'}`}>
                    {isDm ? initials(name) : <Users size={22} weight="fill" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-stone-800 truncate">{name}</span>
                      <span className="text-xs text-stone-400 shrink-0">
                        {formatTime(lastMessages[conv.id]?.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 truncate mt-0.5">{lastPreview(conv)}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* New DM sheet */}
      {newDmOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end z-50 animate-overlay-in"
          onClick={() => setNewDmOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg mx-auto animate-modal-in pb-safe"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h2 className="text-lg font-bold text-stone-800">New Message</h2>
              <button
                onClick={() => setNewDmOpen(false)}
                className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
              >
                &times;
              </button>
            </div>
            <div className="px-4 pb-8 space-y-1 max-h-72 overflow-y-auto">
              {otherMembers.length === 0 ? (
                <p className="text-stone-400 text-sm text-center py-6">
                  No other members in this group yet.
                </p>
              ) : otherMembers.map(m => (
                <button
                  key={m.user_id}
                  onClick={() => startDm(m.user_id)}
                  disabled={starting}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-stone-50 transition-colors disabled:opacity-50"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor(m.user_id)}`}>
                    {initials(m.display_name)}
                  </div>
                  <span className="text-sm font-medium text-stone-800">{m.display_name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {notesOpen && <NotesModal groupId={groupId} onClose={() => setNotesOpen(false)} />}
    </div>
  )
}
