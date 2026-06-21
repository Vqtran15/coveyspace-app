import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import {
  PaperPlaneTilt, Image as ImageIcon, X,
  MagnifyingGlass, ArrowDown, Trash, ArrowLeft, Notepad,
  Users, ArrowBendUpLeft, Crown, PencilSimple, Check,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useModalClose } from '../hooks/useModalClose.js'
import NotesModal from './NotesModal.jsx'

const PAGE_SIZE = 50
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const MORE_EMOJIS = [
  '🔥', '🎉', '👏', '🤔', '😍', '🥰',
  '😅', '🤣', '😊', '🤩', '😎', '👀',
  '💯', '✅', '⭐', '💪', '🙌', '🤦',
]

const AVATAR_COLORS = ['bg-jade', 'bg-coral', 'bg-lagoon-700']
function avatarColor(userId) {
  const n = (userId.charCodeAt(0) ?? 0) + (userId.charCodeAt(userId.length - 1) ?? 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function Initials({ name, userId }) {
  return (
    <div className={`w-8 h-8 rounded-full ${avatarColor(userId)} flex items-center justify-center shrink-0 text-white text-xs font-bold`}>
      {initials(name)}
    </div>
  )
}

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function dateSeparatorLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function highlightText(text, query) {
  if (!query.trim() || !text) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="bg-yellow-200 text-stone-900 rounded-sm">{part}</mark>
          : part
      )}
    </>
  )
}

function typingLabel(users) {
  if (!users.length) return ''
  if (users.length === 1) return `${users[0]} is typing…`
  if (users.length === 2) return `${users[0]} and ${users[1]} are typing…`
  return `${users.length} people are typing…`
}

export default function ChatView({ conversation, session, displayName, groupId, members, isAdmin, exiting, onBack, onRead, onMemberRemoved, onMemberRoleChanged }) {
  const [messages, setMessages]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [hasMore, setHasMore]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [text, setText]                 = useState('')
  const [sending, setSending]           = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [searchOpen, setSearchOpen]     = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [isAtBottom, setIsAtBottom]     = useState(true)
  const [typingUsers, setTypingUsers]   = useState([])
  const [reactions, setReactions]       = useState({})
  const [activeMsg, setActiveMsg]       = useState(null)
  const [menuPos, setMenuPos]           = useState(null)
  const [showMoreEmojis, setShowMoreEmojis] = useState(false)
  const [notesOpen, setNotesOpen]           = useState(false)
  const [replyingTo, setReplyingTo]         = useState(null)
  const [infoOpen, setInfoOpen]             = useState(false)
  const [infoClosing, closeInfo]            = useModalClose(() => setInfoOpen(false))
  const [renamingGroup, setRenamingGroup]   = useState(false)
  const [renameValue, setRenameValue]       = useState('')
  const [renameSaving, setRenameSaving]     = useState(false)
  const [removingId, setRemovingId]         = useState(null)
  const [settingRoleId, setSettingRoleId]   = useState(null)

  const scrollRef          = useRef(null)
  const fileInputRef       = useRef(null)
  const textareaRef        = useRef(null)
  const searchInputRef     = useRef(null)
  const presenceChannelRef = useRef(null)
  const typingTimeoutRef   = useRef(null)
  const lastTapRef         = useRef(null)
  const preserveScrollRef  = useRef(null)

  const myId = session.user.id
  const convId = conversation.id

  function convTitle() {
    if (conversation.type === 'direct') {
      const otherId = conversation.conversation_members?.find(m => m.user_id !== myId)?.user_id
      return members.find(m => m.user_id === otherId)?.display_name || 'Direct Message'
    }
    // If this conversation has all group members, use the stored name (Main Group Chat)
    if ((conversation.conversation_members?.length ?? 0) >= members.length) return conversation.name || 'Group Chat'
    const otherIds = conversation.conversation_members
      ?.filter(m => m.user_id !== myId)
      ?.map(m => m.user_id) ?? []
    const names = otherIds
      .map(id => members.find(m => m.user_id === id)?.display_name?.split(' ')[0])
      .filter(Boolean)
    if (!names.length) return conversation.name || 'Group Chat'
    if (names.length <= 3) return names.join(', ')
    return `${names.slice(0, 3).join(', ')} +${names.length - 3}`
  }

  // ── Messages + reactions + realtime ──────────────────────────────────────
  useEffect(() => {
    onRead?.()
    setLoading(true)
    setMessages([])
    setReplyingTo(null)

    supabase
      .from('messages')
      .select('*, reply_message:reply_to_id(id, body, display_name, image_url)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        setMessages((data ?? []).reverse())
        setHasMore((data ?? []).length === PAGE_SIZE)
        setLoading(false)
      })

    supabase
      .from('reactions')
      .select('*')
      .eq('community_group_id', groupId)
      .then(({ data }) => {
        const map = {}
        for (const r of data ?? []) {
          if (!map[r.message_id]) map[r.message_id] = {}
          if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = []
          map[r.message_id][r.emoji].push(r)
        }
        setReactions(map)
      })

    const msgCh = supabase
      .channel(`chat-msg:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, ({ new: msg }) => {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, { ...msg, _isNew: true }])
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'messages',
      }, ({ old: msg }) => {
        setMessages(prev => prev.filter(m => m.id !== msg.id))
      })
      .subscribe()

    const rxCh = supabase
      .channel(`chat-rx:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'reactions',
        filter: `community_group_id=eq.${groupId}`,
      }, ({ new: r }) => {
        setReactions(prev => ({
          ...prev,
          [r.message_id]: {
            ...(prev[r.message_id] ?? {}),
            [r.emoji]: [...(prev[r.message_id]?.[r.emoji] ?? []), r],
          },
        }))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'reactions',
      }, ({ old: r }) => {
        setReactions(prev => {
          if (!prev[r.message_id]) return prev
          const byEmoji = { ...prev[r.message_id] }
          const filtered = (byEmoji[r.emoji] ?? []).filter(x => x.id !== r.id)
          if (filtered.length) byEmoji[r.emoji] = filtered
          else delete byEmoji[r.emoji]
          return { ...prev, [r.message_id]: byEmoji }
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(msgCh)
      supabase.removeChannel(rxCh)
      // Mark read when leaving the conversation
      supabase.from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', convId)
        .eq('user_id', myId)
        .then(() => {})
    }
  }, [convId])

  // ── Typing presence ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!displayName) return
    const channel = supabase.channel(`presence:${convId}`, {
      config: { presence: { key: myId } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const others = Object.entries(state)
          .filter(([k]) => k !== myId)
          .flatMap(([, p]) => p)
          .filter(p => p.typing)
          .map(p => p.display_name)
        setTypingUsers(others)
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED')
          await channel.track({ display_name: displayName, typing: false })
      })
    presenceChannelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      presenceChannelRef.current = null
    }
  }, [convId, displayName])

  useEffect(() => {
    if (!scrollRef.current || !isAtBottom) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  useLayoutEffect(() => {
    if (!preserveScrollRef.current || !scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight - preserveScrollRef.current
    preserveScrollRef.current = null
  }, [messages])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); setSearchQuery('') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [searchOpen])

  // ── Scroll ────────────────────────────────────────────────────────────────
  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
    if (el.scrollTop < 60 && hasMore && !loadingMore) loadMore()
  }

  async function loadMore() {
    if (loadingMore || !hasMore || !messages.length) return
    setLoadingMore(true)
    const { data } = await supabase
      .from('messages')
      .select('*, reply_message:reply_to_id(id, body, display_name, image_url)')
      .eq('conversation_id', convId)
      .lt('created_at', messages[0].created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    const older = (data ?? []).reverse()
    if (older.length) {
      preserveScrollRef.current = scrollRef.current?.scrollHeight ?? 0
      setMessages(prev => [...older, ...prev])
    }
    setHasMore(older.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  function toggleSearch() {
    if (searchOpen) { setSearchOpen(false); setSearchQuery('') }
    else { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }
  }

  function handleTextInput(e) {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
    if (presenceChannelRef.current) {
      presenceChannelRef.current.track({ display_name: displayName, typing: true })
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        presenceChannelRef.current?.track({ display_name: displayName, typing: false })
      }, 3000)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend(e) {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed && !imagePreview) return
    setSending(true)
    clearTimeout(typingTimeoutRef.current)
    presenceChannelRef.current?.track({ display_name: displayName, typing: false })

    const replyId = replyingTo?.id ?? null
    setReplyingTo(null)

    try {
      let imageUrl = null
      if (imagePreview) {
        const ext = imagePreview.file.name.split('.').pop()
        const path = `${myId}/${convId}_${Date.now()}.${ext}`
        const { data: uploaded, error: upErr } = await supabase.storage
          .from('chat-images')
          .upload(path, imagePreview.file, { contentType: imagePreview.file.type })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(uploaded.path)
        imageUrl = publicUrl
      }

      const { data: newMsg } = await supabase.from('messages').insert({
        community_group_id: groupId,
        conversation_id: convId,
        user_id: myId,
        display_name: displayName || 'Member',
        body: trimmed || null,
        image_url: imageUrl,
        reply_to_id: replyId,
      }).select('*, reply_message:reply_to_id(id, body, display_name, image_url)').single()

      if (newMsg) {
        setIsAtBottom(true)
        setMessages(prev => [...prev, { ...newMsg, _isNew: true }])
      }
      setText('')
      setImagePreview(null)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } catch (err) {
      console.error('Send failed:', err)
    }
    setSending(false)
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB'); return }
    setImagePreview({ file, previewUrl: URL.createObjectURL(file) })
    e.target.value = ''
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  async function toggleReaction(messageId, emoji) {
    const existing = reactions[messageId]?.[emoji]?.find(r => r.user_id === myId)
    setActiveMsg(null); setMenuPos(null)
    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('reactions').insert({
        message_id: messageId,
        community_group_id: groupId,
        user_id: myId,
        emoji,
      })
    }
  }

  async function deleteMessage(msgId) {
    setActiveMsg(null); setMenuPos(null)
    setMessages(prev => prev.filter(m => m.id !== msgId))
    await supabase.from('messages').delete().eq('id', msgId)
  }

  // ── Action menu ───────────────────────────────────────────────────────────
  function openMenu(e, msgId, isOwn) {
    e.preventDefault?.()
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({
      bottom: Math.min(window.innerHeight - rect.top + 8, window.innerHeight - 72),
      ...(isOwn
        ? { right: Math.max(8, window.innerWidth - rect.right) }
        : { left: Math.max(8, rect.left + 32) }),
    })
    setActiveMsg(msgId)
    setShowMoreEmojis(false)
  }

  function handleDoubleTap(e, msgId, isOwn) {
    if (e.target.closest('button, a')) return
    const now = Date.now()
    const last = lastTapRef.current
    if (last && last.msgId === msgId && now - last.time < 300) {
      lastTapRef.current = null
      openMenu(e, msgId, isOwn)
    } else {
      lastTapRef.current = { time: now, msgId }
    }
  }

  function handleReply(msgId) {
    const msg = messages.find(m => m.id === msgId)
    if (msg) {
      setReplyingTo(msg)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
    setActiveMsg(null); setMenuPos(null); setShowMoreEmojis(false)
  }

  function scrollToMessage(msgId) {
    document.getElementById(`msg-${msgId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }


  async function handleRenameGroup(e) {
    e.preventDefault()
    if (!renameValue.trim()) return
    setRenameSaving(true)
    await supabase.rpc('rename_group', { new_name: renameValue.trim() })
    setRenameSaving(false)
    setRenamingGroup(false)
  }

  async function handleSetRole(userId, newRole) {
    setSettingRoleId(userId)
    const { error } = await supabase.rpc('set_member_role', { target_user_id: userId, new_role: newRole })
    if (error) alert(error.message)
    else onMemberRoleChanged?.(userId, newRole)
    setSettingRoleId(null)
  }

  async function handleRemoveMember(userId) {
    const member = members.find(m => m.user_id === userId)
    if (!window.confirm(`Remove ${member?.display_name ?? 'this member'} from the group?`)) return
    setRemovingId(userId)
    const { error } = await supabase.rpc('remove_member', { target_user_id: userId })
    if (!error) onMemberRemoved?.(userId)
    setRemovingId(null)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const filteredMsgs = searchQuery.trim()
    ? messages.filter(m =>
        m.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages

  const items = []
  let lastDate = null
  for (const msg of filteredMsgs) {
    const d = new Date(msg.created_at).toDateString()
    if (d !== lastDate) {
      items.push({ type: 'date', label: dateSeparatorLabel(msg.created_at), key: `date-${msg.created_at}` })
      lastDate = d
    }
    items.push({ type: 'msg', msg })
  }

  const typing = typingLabel(typingUsers)
  const title = convTitle()
  const activeMessage = messages.find(m => m.id === activeMsg)

  const dmOtherMember = conversation.type === 'direct'
    ? members.find(m => m.user_id !== myId)
    : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className={`flex flex-col bg-sunrise-50 ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      style={{ height: 'calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 62px)' }}
    >
      {/* Header */}
      <div className="max-w-3xl mx-auto w-full px-3 pt-6 pb-3 shrink-0 flex items-center gap-2">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <button
          onClick={() => setInfoOpen(true)}
          className="flex-1 min-w-0 text-left hover:opacity-75 transition-opacity"
        >
          <h1 className="text-xl font-bold text-stone-800 truncate">{title}</h1>
        </button>
        {conversation.type === 'group' && (
          <button
            onClick={() => setNotesOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <Notepad size={20} />
          </button>
        )}
        <button
          onClick={toggleSearch}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${searchOpen ? 'bg-jade text-white' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
        >
          <MagnifyingGlass size={20} weight={searchOpen ? 'fill' : 'regular'} />
        </button>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="max-w-3xl mx-auto w-full px-4 pb-2 shrink-0 animate-overlay-in">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-9 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-stone-400 mt-1.5 px-1">
              {filteredMsgs.length} {filteredMsgs.length === 1 ? 'message' : 'messages'} found
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 max-w-3xl mx-auto w-full">
        {loadingMore && (
          <div className="flex justify-center py-3">
            <p className="text-xs text-stone-400 animate-pulse">Loading earlier messages…</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <p className="text-stone-400 text-sm animate-pulse">Loading messages…</p>
          </div>
        ) : filteredMsgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-stone-400">
            {searchQuery ? (
              <>
                <MagnifyingGlass size={48} className="text-stone-300 mb-3" />
                <p className="text-sm">No messages match &ldquo;{searchQuery}&rdquo;</p>
              </>
            ) : (
              <p className="text-sm">No messages yet. Say hello!</p>
            )}
          </div>
        ) : (
          <div className="space-y-0.5 py-2 pb-4">
            {items.map((item, i) => {
              if (item.type === 'date') {
                return (
                  <div key={item.key} className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-stone-200" />
                    <span className="text-xs text-stone-400 font-medium">{item.label}</span>
                    <div className="flex-1 h-px bg-stone-200" />
                  </div>
                )
              }

              const { msg } = item
              const isOwn = msg.user_id === myId
              const nextItem = items[i + 1]
              const prevItem = items[i - 1]
              const isLastInGroup  = nextItem?.type !== 'msg' || nextItem.msg.user_id !== msg.user_id
              const isFirstInGroup = prevItem?.type !== 'msg' || prevItem.msg.user_id !== msg.user_id
              const msgReactions = reactions[msg.id]
              const hasReactions = msgReactions && Object.keys(msgReactions).length > 0

              return (
                <div
                  id={`msg-${msg.id}`}
                  key={msg.id}
                  className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isLastInGroup && !hasReactions ? 'mb-2' : 'mb-0'}`}
                  onContextMenu={e => openMenu(e, msg.id, isOwn)}
                  onClick={e => handleDoubleTap(e, msg.id, isOwn)}
                >
                  {!isOwn && (
                    <div className="w-8 shrink-0 self-start mt-1">
                      {isFirstInGroup && <Initials name={msg.display_name} userId={msg.user_id} />}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} ${msg._isNew ? 'animate-message-in' : ''}`}>
                    {!isOwn && isFirstInGroup && (
                      <p className="text-xs font-semibold text-stone-500 mb-1 ml-1">{msg.display_name}</p>
                    )}
                    <div className={`overflow-hidden ${
                      isOwn
                        ? `bg-jade text-white ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? 'rounded-bl-2xl rounded-br-sm' : 'rounded-b-md'}`
                        : `bg-white border border-stone-200 text-stone-800 ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? 'rounded-br-2xl rounded-bl-sm' : 'rounded-b-md'}`
                    }`}>
                      {/* Reply quote */}
                      {msg.reply_message && (
                        <button
                          onClick={() => scrollToMessage(msg.reply_message.id)}
                          className={`w-full text-left mx-0 px-3 pt-2.5 pb-1.5 border-b ${isOwn ? 'border-white/20' : 'border-stone-100'}`}
                        >
                          <div className={`pl-2 border-l-2 ${isOwn ? 'border-white/60' : 'border-jade'}`}>
                            <p className={`text-[11px] font-semibold truncate ${isOwn ? 'text-white/90' : 'text-jade'}`}>
                              {msg.reply_message.display_name}
                            </p>
                            <p className={`text-[11px] truncate ${isOwn ? 'text-white/70' : 'text-stone-500'}`}>
                              {msg.reply_message.image_url && !msg.reply_message.body ? '📷 Photo' : msg.reply_message.body}
                            </p>
                          </div>
                        </button>
                      )}
                      {msg.image_url && (
                        <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.image_url} alt="shared" className="block max-w-full" style={{ maxHeight: 280 }} />
                        </a>
                      )}
                      {msg.body && (
                        <p className="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {searchQuery.trim() ? highlightText(msg.body, searchQuery) : msg.body}
                        </p>
                      )}
                    </div>

                    {isLastInGroup && (
                      <p className={`text-[10px] text-stone-400 mt-1 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    )}

                    {hasReactions && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isLastInGroup ? 'mb-2' : 'mb-0'}`}>
                        {Object.entries(msgReactions).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                              users.some(u => u.user_id === myId)
                                ? 'bg-jade/10 border-jade/40 text-jade font-medium'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{users.length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {typing && (
        <div className="shrink-0 px-5 pb-1 max-w-3xl mx-auto w-full">
          <p className="text-xs text-stone-400 italic">{typing}</p>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-stone-200 bg-white px-4 pt-3 pb-3 max-w-3xl mx-auto w-full">
        {/* Reply preview */}
        {replyingTo && (
          <div className="flex items-center gap-2 bg-jade/5 border border-jade/20 rounded-xl px-3 py-2 mb-2">
            <div className="w-0.5 self-stretch bg-jade rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-jade truncate">{replyingTo.display_name}</p>
              <p className="text-xs text-stone-400 truncate">
                {replyingTo.image_url && !replyingTo.body ? '📷 Photo' : replyingTo.body}
              </p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-stone-400 hover:text-stone-600 shrink-0">
              <X size={14} weight="bold" />
            </button>
          </div>
        )}
        {imagePreview && (
          <div className="relative inline-block mb-2">
            <img src={imagePreview.previewUrl} alt="preview" className="h-20 w-20 object-cover rounded-xl border border-stone-200" />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-600 text-white rounded-full flex items-center justify-center"
            >
              <X size={10} weight="bold" />
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-jade hover:bg-stone-100 transition-colors shrink-0"
          >
            <ImageIcon size={22} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextInput}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none border border-stone-200 rounded-2xl px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent bg-stone-50"
            style={{ maxHeight: 120, overflowY: 'auto' }}
          />
          <button
            type="submit"
            disabled={sending || (!text.trim() && !imagePreview)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-jade text-white hover:bg-jade-700 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </form>
      </div>

      {/* Scroll-to-bottom */}
      {!isAtBottom && !searchOpen && (
        <button
          onClick={() => {
            setIsAtBottom(true)
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }}
          className="fixed left-1/2 -translate-x-1/2 w-9 h-9 bg-jade text-white rounded-full shadow-lg flex items-center justify-center z-10 animate-overlay-in"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <ArrowDown size={16} weight="bold" />
        </button>
      )}

      {/* Action menu */}
      {activeMsg && menuPos && (
        <div
          className="fixed z-30 bg-white rounded-2xl shadow-xl border border-stone-100 p-1.5"
          style={{ bottom: menuPos.bottom, ...('left' in menuPos ? { left: menuPos.left } : { right: menuPos.right }) }}
        >
          <div className="flex items-center gap-0.5">
            {EMOJIS.map(emoji => {
              const reacted = reactions[activeMsg]?.[emoji]?.some(r => r.user_id === myId)
              return (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(activeMsg, emoji)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${reacted ? 'bg-jade/10' : 'hover:bg-stone-100'}`}
                >
                  {emoji}
                </button>
              )
            })}
            <button
              onClick={() => setShowMoreEmojis(v => !v)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${showMoreEmojis ? 'bg-jade text-white' : 'text-stone-400 hover:bg-stone-100'}`}
            >
              {showMoreEmojis ? '×' : '+'}
            </button>
            <div className="w-px h-6 bg-stone-100 mx-0.5" />
            <button
              onClick={() => handleReply(activeMsg)}
              className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-700 transition-colors"
            >
              <ArrowBendUpLeft size={15} weight="bold" />
            </button>
            {activeMessage?.user_id === myId && (
              <>
                <div className="w-px h-6 bg-stone-100 mx-0.5" />
                <button
                  onClick={() => deleteMessage(activeMsg)}
                  className="w-9 h-9 rounded-xl hover:bg-red-50 flex items-center justify-center text-stone-400 hover:text-red-500 transition-colors"
                >
                  <Trash size={14} weight="bold" />
                </button>
              </>
            )}
          </div>
          {showMoreEmojis && (
            <div className="grid grid-cols-6 gap-0.5 mt-1 pt-1 border-t border-stone-100">
              {MORE_EMOJIS.map(emoji => {
                const reacted = reactions[activeMsg]?.[emoji]?.some(r => r.user_id === myId)
                return (
                  <button
                    key={emoji}
                    onClick={() => toggleReaction(activeMsg, emoji)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${reacted ? 'bg-jade/10' : 'hover:bg-stone-100'}`}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeMsg && (
        <div className="fixed inset-0 z-20" onClick={() => { setActiveMsg(null); setMenuPos(null); setShowMoreEmojis(false) }} />
      )}

      {/* Conversation info panel */}
      {infoOpen && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end z-50 ${infoClosing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
          onClick={closeInfo}
        >
          <div
            className={`bg-white rounded-t-2xl w-full max-w-lg mx-auto max-h-[70vh] overflow-y-auto ${infoClosing ? 'animate-modal-out' : 'animate-modal-in'}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
              <h2 className="text-lg font-bold text-stone-800">
                {conversation.type === 'group' ? 'Group Info' : 'Contact Info'}
              </h2>
              <button
                onClick={closeInfo}
                className="text-stone-400 hover:text-stone-600 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
              >
                &times;
              </button>
            </div>

            {/* Avatar + name */}
            <div className="flex flex-col items-center py-5 px-5">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 ${conversation.type === 'group' ? 'bg-jade' : avatarColor(dmOtherMember?.user_id ?? '')}`}>
                {conversation.type === 'group'
                  ? <Users size={40} weight="fill" className="text-white" />
                  : <span className="text-white text-2xl font-bold">{initials(title)}</span>
                }
              </div>
              {renamingGroup ? (
                <form onSubmit={handleRenameGroup} className="flex items-center gap-2 w-full max-w-xs">
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="flex-1 border border-stone-200 rounded-xl px-3 py-1.5 text-base font-bold text-stone-800 text-center focus:outline-none focus:ring-2 focus:ring-jade"
                  />
                  <button type="submit" disabled={renameSaving} className="text-jade disabled:opacity-40">
                    <Check size={18} weight="bold" />
                  </button>
                  <button type="button" onClick={() => setRenamingGroup(false)} className="text-stone-400">
                    <X size={18} weight="bold" />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-stone-800 text-center">{title}</h3>
                  {isAdmin && conversation.type === 'group' && (
                    <button
                      onClick={() => { setRenameValue(title); setRenamingGroup(true) }}
                      className="text-stone-400 hover:text-stone-600 transition-colors"
                    >
                      <PencilSimple size={15} />
                    </button>
                  )}
                </div>
              )}
              <p className="text-sm text-stone-400 mt-1">
                {conversation.type === 'group' ? `${members.length} member${members.length !== 1 ? 's' : ''}` : 'Direct Message'}
              </p>
            </div>

            {/* Member list (group only) */}
            {conversation.type === 'group' && (
              <div className="px-5 pb-8">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Members</p>
                <div className="space-y-1">
                  {members.map(m => (
                    <div key={m.user_id} className="flex items-center gap-3 py-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${avatarColor(m.user_id)}`}>
                        {initials(m.display_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-stone-800 truncate">{m.display_name}</span>
                          {m.role === 'admin' && (
                            <Crown size={12} weight="fill" className="text-jade shrink-0" />
                          )}
                          {m.user_id === myId && (
                            <span className="text-stone-400 text-xs shrink-0">(You)</span>
                          )}
                        </div>
                      </div>
                      {isAdmin && m.user_id !== myId && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleSetRole(m.user_id, m.role === 'admin' ? 'member' : 'admin')}
                            disabled={!!settingRoleId}
                            title={m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                            className="text-stone-300 hover:text-jade transition-colors disabled:opacity-40"
                          >
                            {settingRoleId === m.user_id
                              ? <span className="text-xs text-stone-300">…</span>
                              : <Crown size={14} weight={m.role === 'admin' ? 'fill' : 'regular'} />
                            }
                          </button>
                          <button
                            onClick={() => handleRemoveMember(m.user_id)}
                            disabled={removingId === m.user_id}
                            className="text-stone-300 hover:text-red-400 transition-colors disabled:opacity-40"
                          >
                            {removingId === m.user_id
                              ? <span className="text-xs text-stone-300">…</span>
                              : <X size={15} weight="bold" />
                            }
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {notesOpen && <NotesModal groupId={groupId} onClose={() => setNotesOpen(false)} />}
    </div>
  )
}
