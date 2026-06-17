import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import {
  ChatCircleDots, PaperPlaneTilt, Image as ImageIcon, X,
  MagnifyingGlass, NotePencil, ArrowDown, Trash,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import NotesModal from './NotesModal.jsx'

const PAGE_SIZE = 50
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

const AVATAR_COLORS = ['bg-jade', 'bg-coral', 'bg-lagoon-700']
function avatarColor(userId) {
  const n = (userId.charCodeAt(0) ?? 0) + (userId.charCodeAt(userId.length - 1) ?? 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function Initials({ name, userId }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className={`w-8 h-8 rounded-full ${avatarColor(userId)} flex items-center justify-center shrink-0 text-white text-xs font-bold`}>
      {initials}
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

export default function ChatTab({ session, displayName, groupId, onRead }) {
  const [messages, setMessages]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [hasMore, setHasMore]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [text, setText]                 = useState('')
  const [sending, setSending]           = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [searchOpen, setSearchOpen]     = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [notesOpen, setNotesOpen]       = useState(false)
  const [isAtBottom, setIsAtBottom]     = useState(true)
  const [typingUsers, setTypingUsers]   = useState([])
  const [reactions, setReactions]       = useState({})
  const [activeMsg, setActiveMsg]       = useState(null)
  const [menuPos, setMenuPos]           = useState(null)

  const scrollRef          = useRef(null)
  const fileInputRef       = useRef(null)
  const textareaRef        = useRef(null)
  const searchInputRef     = useRef(null)
  const presenceChannelRef = useRef(null)
  const typingTimeoutRef   = useRef(null)
  const longPressTimerRef  = useRef(null)
  const preserveScrollRef  = useRef(null)

  const { className: headerClass } = useEntranceAnimation('/chat', 0, { direction: 'left' })

  // ── Data: messages + reactions + realtime subscriptions ──────────────────
  useEffect(() => {
    if (!groupId) return
    onRead?.()

    // Last PAGE_SIZE messages, newest-first then reversed
    supabase
      .from('messages')
      .select('*')
      .eq('community_group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        setMessages((data ?? []).reverse())
        setHasMore((data ?? []).length === PAGE_SIZE)
        setLoading(false)
      })

    // Reactions for the group
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
      .channel(`chat-msg:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `community_group_id=eq.${groupId}`,
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
      .channel(`chat-rx:${groupId}`)
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
    }
  }, [groupId])

  // ── Typing presence ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId || !displayName) return
    const channel = supabase.channel(`presence:${groupId}`, {
      config: { presence: { key: session.user.id } },
    })
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const others = Object.entries(state)
          .filter(([k]) => k !== session.user.id)
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
  }, [groupId, displayName])

  // ── Auto-scroll on new messages (only when already at bottom) ─────────────
  useEffect(() => {
    if (!scrollRef.current || !isAtBottom) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  // ── Restore scroll position after prepending older messages ───────────────
  useLayoutEffect(() => {
    if (!preserveScrollRef.current || !scrollRef.current) return
    scrollRef.current.scrollTop =
      scrollRef.current.scrollHeight - preserveScrollRef.current
    preserveScrollRef.current = null
  }, [messages])

  // ── Close search on Escape ────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); setSearchQuery('') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [searchOpen])

  // ── Scroll handler: track bottom + trigger pagination ────────────────────
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
      .select('*')
      .eq('community_group_id', groupId)
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

  // ── Search ────────────────────────────────────────────────────────────────
  function toggleSearch() {
    if (searchOpen) { setSearchOpen(false); setSearchQuery('') }
    else { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50) }
  }

  // ── Text input + typing indicator ─────────────────────────────────────────
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

  // ── Send message ──────────────────────────────────────────────────────────
  async function handleSend(e) {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed && !imagePreview) return
    setSending(true)
    clearTimeout(typingTimeoutRef.current)
    presenceChannelRef.current?.track({ display_name: displayName, typing: false })

    try {
      let imageUrl = null
      if (imagePreview) {
        const ext = imagePreview.file.name.split('.').pop()
        const path = `${groupId}/${session.user.id}_${Date.now()}.${ext}`
        const { data: uploaded, error: upErr } = await supabase.storage
          .from('chat-images')
          .upload(path, imagePreview.file, { contentType: imagePreview.file.type })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(uploaded.path)
        imageUrl = publicUrl
      }

      const { data: newMsg } = await supabase.from('messages').insert({
        community_group_id: groupId,
        user_id: session.user.id,
        display_name: displayName || 'Member',
        body: trimmed || null,
        image_url: imageUrl,
      }).select().single()

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
    setActiveMsg(null)
    setMenuPos(null)
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

  // ── Delete message ────────────────────────────────────────────────────────
  async function deleteMessage(msgId) {
    setActiveMsg(null)
    setMenuPos(null)
    setMessages(prev => prev.filter(m => m.id !== msgId))
    await supabase.from('messages').delete().eq('id', msgId)
  }

  // ── Action menu (long-press / right-click) ────────────────────────────────
  function openMenu(e, msgId, isOwn) {
    e.preventDefault?.()
    clearTimeout(longPressTimerRef.current)
    const rect = e.currentTarget.getBoundingClientRect()
    const bottom = window.innerHeight - rect.top + 8
    setMenuPos({
      bottom: Math.min(bottom, window.innerHeight - 72),
      ...(isOwn
        ? { right: Math.max(8, window.innerWidth - rect.right) }
        : { left: Math.max(8, rect.left + 32) }),
    })
    setActiveMsg(msgId)
  }

  function startLongPress(e, msgId, isOwn) {
    longPressTimerRef.current = setTimeout(() => openMenu(e, msgId, isOwn), 500)
  }

  function cancelLongPress() {
    clearTimeout(longPressTimerRef.current)
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const myId = session.user.id

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

  // ── Render ────────────────────────────────────────────────────────────────
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
            onClick={toggleSearch}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${searchOpen ? 'bg-jade text-white' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
          >
            <MagnifyingGlass size={20} weight={searchOpen ? 'fill' : 'regular'} />
          </button>
          <button
            onClick={() => setNotesOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <NotePencil size={20} />
          </button>
        </div>
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
              <>
                <ChatCircleDots size={48} weight="fill" className="text-stone-300 mb-3" />
                <p className="text-sm">No messages yet. Say hello!</p>
              </>
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
                  key={msg.id}
                  className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isLastInGroup && !hasReactions ? 'mb-2' : 'mb-0'}`}
                  onContextMenu={e => openMenu(e, msg.id, isOwn)}
                  onTouchStart={e => startLongPress(e, msg.id, isOwn)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
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

                    {/* Reactions */}
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

      {/* Scroll-to-bottom button */}
      {!isAtBottom && !searchOpen && (
        <button
          onClick={() => {
            setIsAtBottom(true)
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
          }}
          className="fixed right-4 w-9 h-9 bg-jade text-white rounded-full shadow-lg flex items-center justify-center z-10 animate-overlay-in"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <ArrowDown size={16} weight="bold" />
        </button>
      )}

      {/* Action menu (emoji picker + delete) */}
      {activeMsg && menuPos && (
        <div
          className="fixed z-30 bg-white rounded-2xl shadow-xl border border-stone-100 p-1.5 flex items-center gap-0.5"
          style={{
            bottom: menuPos.bottom,
            ...('left' in menuPos ? { left: menuPos.left } : { right: menuPos.right }),
          }}
        >
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
          {messages.find(m => m.id === activeMsg)?.user_id === myId && (
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
      )}

      {/* Click-away to close action menu */}
      {activeMsg && (
        <div className="fixed inset-0 z-20" onClick={() => { setActiveMsg(null); setMenuPos(null) }} />
      )}

      {notesOpen && (
        <NotesModal groupId={groupId} onClose={() => setNotesOpen(false)} />
      )}
    </div>
  )
}
