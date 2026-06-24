import { useState, useEffect, useRef } from 'react'
import { ChatCircleDots, PencilSimple, Users, MagnifyingGlass, X, Check, Trash, GearSix } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import { useModalClose } from '../hooks/useModalClose.js'

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

export default function ConversationList({ session, groupId, members, enterClass, onSelect, onRead, onOpenSettings }) {
  const [conversations, setConversations] = useState([])
  const [lastMessages, setLastMessages]   = useState({})
  const [lastReadAt, setLastReadAt]       = useState(null)
  const [loading, setLoading]             = useState(true)
  const [newDmOpen, setNewDmOpen]         = useState(false)
  const [starting, setStarting]           = useState(false)
  const [dmClosing, closeDm, , resetDm]   = useModalClose(() => setNewDmOpen(false))
  const [searchOpen, setSearchOpen]       = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [newChatMode, setNewChatMode]         = useState('dm')
  const [selectedMembers, setSelectedMembers] = useState(new Set())
  const [creating, setCreating]               = useState(false)
  const [confirmDeleteConv, setConfirmDeleteConv] = useState(null)
  const [deleteClosing, closeDeleteConfirm, resetDeleteConfirm] = useModalClose(() => setConfirmDeleteConv(null))
  const [deletingConvId, setDeletingConvId]   = useState(null)
  const searchInputRef = useRef(null)

  const myId = session.user.id
  const { className: headerClass } = useEntranceAnimation('/chat', 0)

  async function loadConversations() {
    try {
      const { data: convs, error } = await supabase
        .from('conversations')
        .select('*, conversation_members(user_id)')
        .order('updated_at', { ascending: false })

      if (error) throw error
      if (!convs?.length) return

      setConversations(convs)

      const convIds = convs.map(c => c.id)
      const [{ data: msgs }, { data: myMemberships }] = await Promise.all([
        supabase
          .from('messages')
          .select('conversation_id, body, display_name, image_url, created_at, user_id')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('conversation_members')
          .select('conversation_id, last_read_at')
          .eq('user_id', myId)
          .in('conversation_id', convIds),
      ])

      const msgMap = {}
      for (const msg of msgs ?? []) {
        if (!msgMap[msg.conversation_id]) msgMap[msg.conversation_id] = msg
      }
      setLastMessages(msgMap)

      const readMap = {}
      for (const m of myMemberships ?? []) {
        readMap[m.conversation_id] = m.last_read_at
      }
      setLastReadAt(readMap)
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
    if (conv.type === 'direct') {
      const otherId = conv.conversation_members?.find(m => m.user_id !== myId)?.user_id
      return members.find(m => m.user_id === otherId)?.display_name || 'Direct Message'
    }
    // If this conversation has all group members, use the stored name (Main Group Chat)
    if ((conv.conversation_members?.length ?? 0) >= members.length) return conv.name || 'Group Chat'
    const otherIds = conv.conversation_members
      ?.filter(m => m.user_id !== myId)
      ?.map(m => m.user_id) ?? []
    const names = otherIds
      .map(id => members.find(m => m.user_id === id)?.display_name?.split(' ')[0])
      .filter(Boolean)
    if (!names.length) return conv.name || 'Group Chat'
    if (names.length <= 3) return names.join(', ')
    return `${names.slice(0, 3).join(', ')} +${names.length - 3}`
  }

  function lastPreview(conv) {
    const msg = lastMessages[conv.id]
    if (!msg) return 'No messages yet'
    const body = msg.image_url && !msg.body ? '📷 Photo'
      : msg.image_url ? `📷 ${msg.body}`
      : (msg.body || '')
    if (conv.type === 'group') return `${msg.display_name}: ${body}`
    return body
  }

  function isUnread(conv) {
    if (!lastReadAt) return false
    const lastMsg = lastMessages[conv.id]
    if (!lastMsg || lastMsg.user_id === myId) return false
    const readAt = lastReadAt[conv.id]
    if (!readAt) return true
    return new Date(lastMsg.created_at) > new Date(readAt)
  }

  function isMainGroupChat(conv) {
    if (conv.type !== 'group') return false
    return (conv.conversation_members?.length ?? 0) >= members.length
  }

  async function deleteConversation(conv) {
    setDeletingConvId(conv.id)
    setConfirmDeleteConv(null)
    const { error } = await supabase.rpc('delete_conversation', { conv_id: conv.id })
    if (!error) {
      setConversations(prev => prev.filter(c => c.id !== conv.id))
      setLastMessages(prev => { const n = { ...prev }; delete n[conv.id]; return n })
    }
    setDeletingConvId(null)
  }

  function openModal() {
    resetDm()
    setNewChatMode('dm')
    setSelectedMembers(new Set())
    setNewDmOpen(true)
  }

  function switchMode(mode) {
    setNewChatMode(mode)
    if (mode === 'group') setSelectedMembers(new Set())
  }

  function toggleMember(userId) {
    setSelectedMembers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function startDm(otherId) {
    setStarting(true)
    const { data: convId, error } = await supabase.rpc('find_or_create_dm', { other_user_id: otherId })
    if (error || !convId) { setStarting(false); return }

    const existing = conversations.find(c => c.id === convId)
    if (existing) {
      closeDm()
      setStarting(false)
      onSelect(existing)
      return
    }

    const { data: conv } = await supabase
      .from('conversations')
      .select('*, conversation_members(user_id)')
      .eq('id', convId)
      .single()

    closeDm()
    setStarting(false)
    if (conv) {
      setConversations(prev => [conv, ...prev])
      onSelect(conv)
    }
  }

  async function createGroupChat() {
    if (selectedMembers.size === 0) return
    setCreating(true)
    const memberIds = Array.from(selectedMembers)
    const chatName = memberIds
      .map(id => members.find(m => m.user_id === id)?.display_name?.split(' ')[0])
      .filter(Boolean)
      .join(', ') || 'Group Chat'
    const { data: convId, error } = await supabase.rpc('create_group_chat', {
      chat_name: chatName,
      member_ids: memberIds,
    })
    if (error || !convId) { setCreating(false); return }

    const { data: conv } = await supabase
      .from('conversations')
      .select('*, conversation_members(user_id)')
      .eq('id', convId)
      .single()

    closeDm()
    setCreating(false)
    if (conv) {
      setConversations(prev => [conv, ...prev])
      onSelect(conv)
    }
  }

  const otherMembers = members.filter(m => m.user_id !== myId)

  return (
    <div
      className={`flex flex-col bg-sunrise-50 ${enterClass ?? ''}`}
      style={{ height: 'calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 62px)' }}
    >
      {/* Header */}
      <div className={`max-w-3xl mx-auto w-full px-4 pt-6 pb-3 shrink-0 flex items-center justify-between ${headerClass}`}>
        <div className="flex items-center gap-3">
          <ChatCircleDots size={32} weight="fill" className="text-jade shrink-0" />
          <h1 className="text-3xl font-bold text-stone-800">Chat</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <GearSix size={20} weight="regular" />
          </button>
          <button
            onClick={() => {
              setSearchOpen(v => !v)
              setSearchQuery('')
              if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50)
            }}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${searchOpen ? 'bg-jade text-white' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
          >
            <MagnifyingGlass size={20} weight={searchOpen ? 'fill' : 'regular'} />
          </button>
          <button
            onClick={openModal}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-jade text-white hover:bg-jade-700 transition-colors"
            title="New message"
          >
            <PencilSimple size={20} weight="bold" />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="max-w-3xl mx-auto w-full px-4 pb-3 shrink-0 animate-fade-up">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations…"
              className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-9 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>
      )}

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
            {conversations.filter(conv => {
              if (!searchQuery.trim()) return true
              const q = searchQuery.toLowerCase()
              return convName(conv).toLowerCase().includes(q) ||
                lastPreview(conv).toLowerCase().includes(q)
            }).map((conv, i) => {
              const name    = convName(conv)
              const isDm    = conv.type === 'direct'
              const otherId = isDm
                ? conv.conversation_members?.find(m => m.user_id !== myId)?.user_id
                : null
              const unread     = isUnread(conv)
              const deletable  = !isMainGroupChat(conv)
              const isDeleting = deletingConvId === conv.id

              return (
                <div
                  key={conv.id}
                  className="flex items-stretch hover:bg-white/70 transition-colors bg-sunrise-50 animate-fade-up"
                  style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
                >
                  {/* Main row */}
                  <button
                    onClick={() => onSelect(conv)}
                    className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left min-w-0"
                  >
                    <div className="relative shrink-0">
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold ${isDm ? avatarColor(otherId ?? '') : 'bg-jade'}`}>
                        {isDm ? initials(name) : <Users size={22} weight="fill" />}
                      </div>
                      {unread && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-jade rounded-full border-2 border-sunrise-50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-sm truncate ${unread ? 'font-bold text-stone-900' : 'font-semibold text-stone-800'}`}>
                          {name}
                        </span>
                        <span className={`text-xs shrink-0 ${unread ? 'font-semibold text-jade' : 'text-stone-400'}`}>
                          {formatTime(lastMessages[conv.id]?.created_at)}
                        </span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${unread ? 'text-stone-700 font-medium' : 'text-stone-400'}`}>
                        {lastPreview(conv)}
                      </p>
                    </div>
                  </button>

                  {/* Trash button */}
                  {deletable && (
                    <button
                      onClick={() => { resetDeleteConfirm(); setConfirmDeleteConv(conv) }}
                      className="shrink-0 px-4 flex items-center text-stone-300 hover:text-red-500 active:text-red-600 transition-colors"
                    >
                      {isDeleting ? <span className="text-xs text-stone-300">…</span> : <Trash size={16} />}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDeleteConv && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end z-50 ${deleteClosing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
          onClick={closeDeleteConfirm}
        >
          <div
            className={`bg-white rounded-t-2xl w-full max-w-lg mx-auto pb-safe ${deleteClosing ? 'animate-modal-out' : 'animate-modal-in'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-6">
              <h2 className="text-lg font-bold text-stone-800 mb-1">Delete conversation?</h2>
              <p className="text-sm text-stone-500 mb-5">
                All messages in <span className="font-semibold text-stone-700">{convName(confirmDeleteConv)}</span> will be permanently deleted for everyone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={closeDeleteConfirm}
                  className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteConversation(confirmDeleteConv)}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                >
                  Delete forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New message sheet */}
      {newDmOpen && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end z-50 ${dmClosing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
          onClick={closeDm}
        >
          <div
            className={`bg-white rounded-t-2xl w-full max-w-lg mx-auto ${dmClosing ? 'animate-modal-out' : 'animate-modal-in'}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4">
              <h2 className="text-lg font-bold text-stone-800">New Message</h2>
              <button
                onClick={closeDm}
                className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
              >
                &times;
              </button>
            </div>

            {/* Mode switcher */}
            <div className="mx-5 mb-4 flex bg-stone-100 rounded-xl p-1">
              <button
                onClick={() => switchMode('dm')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${newChatMode === 'dm' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                Direct message
              </button>
              <button
                onClick={() => switchMode('group')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${newChatMode === 'group' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                Group chat
              </button>
            </div>

            {/* Mode content — keyed so it remounts and animates on tab switch */}
            <div key={newChatMode} className="animate-fade-up">

            {/* DM mode */}
            {newChatMode === 'dm' && (
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
            )}

            {/* Group chat mode */}
            {newChatMode === 'group' && (
              <div className="px-5 pb-8">
                {otherMembers.length === 0 ? (
                  <p className="text-stone-400 text-sm text-center py-4">
                    No other members in this group yet.
                  </p>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">
                      Add members
                      {selectedMembers.size > 0 && (
                        <span className="ml-2 text-jade normal-case font-semibold">
                          {selectedMembers.size} selected
                        </span>
                      )}
                    </p>
                    <div className="space-y-0.5 max-h-48 overflow-y-auto mb-4">
                      {otherMembers.map(m => {
                        const selected = selectedMembers.has(m.user_id)
                        return (
                          <button
                            key={m.user_id}
                            onClick={() => toggleMember(m.user_id)}
                            className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-stone-50 transition-colors"
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor(m.user_id)}`}>
                              {initials(m.display_name)}
                            </div>
                            <span className="flex-1 text-sm font-medium text-stone-800 text-left">{m.display_name}</span>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-jade border-jade' : 'border-stone-300'}`}>
                              {selected && <Check size={11} weight="bold" className="text-white" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
                <button
                  onClick={createGroupChat}
                  disabled={creating || selectedMembers.size === 0}
                  className="w-full py-3 rounded-xl bg-jade text-white font-semibold text-sm hover:bg-jade-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating…' : 'Create group chat'}
                </button>
              </div>
            )}

            </div>{/* end keyed animation wrapper */}
          </div>
        </div>
      )}

    </div>
  )
}
