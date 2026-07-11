import { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react'
import EmojiPicker from 'emoji-picker-react'
import {
  PaperPlaneTilt, Image as ImageIcon, X,
  MagnifyingGlass, ArrowDown, ArrowUp, Trash, ArrowLeft, Notepad,
  Users, ArrowBendUpLeft, ShieldCheck, PencilSimple, Check, Copy, Smiley,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { useToast } from '../lib/toast.jsx'
import NotesModal from './NotesModal.jsx'
import { AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'
import { initials, formatMessageTime } from '../utils/format.js'
import { haptic } from '../lib/haptic.js'
import { trackEvent } from '../lib/analytics.js'

const PAGE_SIZE   = 50
const CACHE_LIMIT = 50
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const GROUP_TIME_GAP = 5 * 60 * 1000
const DRAFT_KEY    = convId => `draft:${convId}`
const READ_AT_KEY  = convId => `readAt:${convId}`
const CACHE_KEY    = convId => `chat_v1_${convId}`

function loadCache(convId) {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY(convId)) ?? 'null') } catch { return null }
}
function saveCache(convId, msgs) {
  try {
    const clean = msgs
      .filter(m => !m._tempId && !m._pending && !m._failed)
      .slice(-CACHE_LIMIT)
      .map(({ _isNew, ...m }) => m)
    localStorage.setItem(CACHE_KEY(convId), JSON.stringify(clean))
  } catch {}
}

function Initials({ name, userId, icon, colorKey }) {
  return (
    <div className={`w-8 h-8 rounded-full ${avatarColor(userId, colorKey)} flex items-center justify-center shrink-0`}>
      {icon
        ? <AvatarIcon name={icon} size={16} />
        : <span className="text-white text-xs font-bold">{initials(name)}</span>
      }
    </div>
  )
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

function renderMessageBody(body, query) {
  // eslint-disable-next-line no-useless-escape
  const URL_RE = /https?:\/\/[^\s<>'"]+[^\s<>'".,!?;:)\]']*/g
  const parts = []
  let last = 0, m
  while ((m = URL_RE.exec(body)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: body.slice(last, m.index) })
    parts.push({ type: 'url', value: m[0] })
    last = m.index + m[0].length
  }
  if (last < body.length) parts.push({ type: 'text', value: body.slice(last) })
  if (!parts.length) return query ? highlightText(body, query) : body
  return parts.map((part, i) =>
    part.type === 'url'
      ? <a key={i} href={part.value} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="underline break-all text-inherit opacity-80 active:opacity-60">
            {part.value}
          </a>
      : <span key={i}>{query ? highlightText(part.value, query) : part.value}</span>
  )
}

function typingLabel(users) {
  if (!users.length) return ''
  if (users.length === 1) return `${users[0]} is typing…`
  if (users.length === 2) return `${users[0]} and ${users[1]} are typing…`
  return `${users.length} people are typing…`
}

export default function ChatView({ conversation, session, displayName, groupId, members, isAdmin, exiting, onBack, onRead, openedWithLastReadAt = null }) {
  const [messages, setMessages]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [hasMore, setHasMore]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [text, setText]                 = useState(() => localStorage.getItem(DRAFT_KEY(conversation.id)) ?? '')
  const [sending, setSending]           = useState(false)
  const [imagePreviews, setImagePreviews] = useState([])
  const [searchOpen, setSearchOpen]     = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [isAtBottom, setIsAtBottom]     = useState(true)
  const [typingUsers, setTypingUsers]   = useState([])
  const [reactions, setReactions]       = useState({})
  const [activeMsg, setActiveMsg]       = useState(null)
  const [menuPos, setMenuPos]           = useState(null)
  const [showMoreEmojis, setShowMoreEmojis] = useState(false)
  const [reactionPickerClosing, setReactionPickerClosing] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [emojiPickerClosing, setEmojiPickerClosing] = useState(false)
  const [notesOpen, setNotesOpen]           = useState(false)
  const [replyingTo, setReplyingTo]         = useState(null)
  const [infoOpen, setInfoOpen]             = useState(false)
  const [infoClosing, closeInfo]            = useModalClose(() => setInfoOpen(false))
  const [menuClosing, closeMenu, resetMenuClosing] = useModalClose(() => {
    setActiveMsg(null); setMenuPos(null); setShowMoreEmojis(false); setReactionPickerClosing(false); setConfirmDeleteMsg(false)
  }, 150)
  const [renamingGroup, setRenamingGroup]   = useState(false)
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState(false)
  const [editingMsgId, setEditingMsgId]         = useState(null)
  const [editText, setEditText]                 = useState('')
  const [editClosingId, setEditClosingId]       = useState(null)
  const [selectedMsgId, setSelectedMsgId]       = useState(null)
  const [confirmDeleteId, setConfirmDeleteId]   = useState(null)
  const toast = useToast()
  const [renameValue, setRenameValue]       = useState('')
  const [renameSaving, setRenameSaving]     = useState(false)
  const [memberReadTimes, setMemberReadTimes] = useState({})
  const [unreadCount, setUnreadCount]         = useState(0)
  const [contentReady, setContentReady]       = useState(false)
  const [visible, setVisible]                 = useState(false)
  const [fetchingFresh, setFetchingFresh]     = useState(false)
  const [firstUnreadId, setFirstUnreadId]     = useState(null)
  const [openUnreadCount, setOpenUnreadCount] = useState(0)
  const [lightboxImg, setLightboxImg]         = useState(null)

  const scrollRef          = useRef(null)
  const editTextareaRef    = useRef(null)
  const fileInputRef       = useRef(null)
  const textareaRef        = useRef(null)
  const searchInputRef     = useRef(null)
  const presenceChannelRef = useRef(null)
  const typingTimeoutRef   = useRef(null)
  const lastTapRef         = useRef(null)
  const longPressRef       = useRef(null)
  const longPressFiredRef  = useRef(false)
  const imgTapRef          = useRef(null)
  const preserveScrollRef  = useRef(null)
  const isAtBottomRef              = useRef(true)
  const initialScrollDoneRef       = useRef(false)
  const pendingScrollRef           = useRef(null)

  const wasAtBottomRef        = useRef(true)
  const messagesContainerRef  = useRef(null)
  const sendingRef            = useRef(false)

  function scrollToBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }

  const myId = session.user.id
  const convId = conversation.id

  // Resolve the current display name for a message sender.
  // Falls back to the stored name for users who've left the group.
  function senderName(userId, storedName) {
    return members.find(m => m.user_id === userId)?.display_name || storedName
  }

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
    setMessages([])
    setReplyingTo(null)
    setMemberReadTimes({})
    setUnreadCount(0)
    setContentReady(false)
    setVisible(false)
    setFetchingFresh(false)
    setFirstUnreadId(null)
    setOpenUnreadCount(0)
    initialScrollDoneRef.current = false
    pendingScrollRef.current = null
    setText(localStorage.getItem(DRAFT_KEY(convId)) ?? '')

    const cached = loadCache(convId)
    if (cached?.length) {
      setMessages(cached)
      setHasMore(cached.length >= CACHE_LIMIT)
      setLoading(false)
      setFetchingFresh(true)
    } else {
      setLoading(true)
    }

    supabase
      .from('messages')
      .select('*, reply_message:reply_to_id(id, body, display_name, image_url)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        const msgs = (data ?? []).reverse()
        saveCache(convId, msgs)
        setMessages(msgs)
        setHasMore((data ?? []).length === PAGE_SIZE)
        setLoading(false)
        setFetchingFresh(false)
        if (!msgs.length) return
        supabase
          .from('reactions')
          .select('id, message_id, emoji, user_id')
          .in('message_id', msgs.map(m => m.id))
          .then(({ data: rxData }) => {
            const map = {}
            for (const r of rxData ?? []) {
              if (!map[r.message_id]) map[r.message_id] = {}
              if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = []
              map[r.message_id][r.emoji].push(r)
            }
            setReactions(map)
          })
      })

    const msgCh = supabase
      .channel(`chat-msg:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, ({ new: msg }) => {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          const updated = [...prev, { ...msg, _isNew: true }]
          saveCache(convId, updated)
          return updated
        })
        if (msg.user_id !== myId) {
          if (isAtBottomRef.current) {
            const now = new Date().toISOString()
            localStorage.setItem(READ_AT_KEY(convId), now)
            supabase.from('conversation_members')
              .update({ last_read_at: now })
              .eq('conversation_id', convId).eq('user_id', myId).then(() => {})
          } else {
            setUnreadCount(prev => prev + 1)
          }
        }
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

    // Load member read times for read receipts
    supabase
      .from('conversation_members')
      .select('user_id, last_read_at')
      .eq('conversation_id', convId)
      .then(({ data }) => {
        const map = {}
        for (const m of data ?? []) {
          if (m.user_id !== myId) map[m.user_id] = m.last_read_at
        }
        setMemberReadTimes(map)
      })

    // Mark ourselves as read on enter
    const openTime = new Date().toISOString()
    localStorage.setItem(READ_AT_KEY(convId), openTime)
    supabase.from('conversation_members')
      .update({ last_read_at: openTime })
      .eq('conversation_id', convId).eq('user_id', myId).then(() => {})

    const readCh = supabase
      .channel(`read:${convId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversation_members',
        filter: `conversation_id=eq.${convId}`,
      }, ({ new: row }) => {
        if (row.user_id !== myId) {
          setMemberReadTimes(prev => ({ ...prev, [row.user_id]: row.last_read_at }))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(msgCh)
      supabase.removeChannel(rxCh)
      supabase.removeChannel(readCh)
      const closeTime = new Date().toISOString()
      localStorage.setItem(READ_AT_KEY(convId), closeTime)
      supabase.from('conversation_members')
        .update({ last_read_at: closeTime })
        .eq('conversation_id', convId)
        .eq('user_id', myId)
        .then(() => {})
    }
  }, [convId])

  // ── Initial load: mark contentReady once messages arrive ─────────────────
  useEffect(() => {
    if (loading || initialScrollDoneRef.current) return
    initialScrollDoneRef.current = true
    if (openedWithLastReadAt) {
      const unread = messages.filter(m => m.created_at > openedWithLastReadAt && m.user_id !== myId)
      if (unread.length > 0) {
        setFirstUnreadId(unread[0].id)
        setOpenUnreadCount(unread.length)
      }
    }
    setContentReady(true)
  }, [loading, messages])

  // Wait for all images to be decoded (not just fetched) before revealing.
  // img.decode() resolves when pixels are ready to paint — covers both uncached
  // images (waits for network) and cached-but-not-yet-decoded images that would
  // otherwise cause a layout-shift flicker immediately after reveal.
  useEffect(() => {
    if (!contentReady) return
    if (!messagesContainerRef.current) { setVisible(true); return }
    const imgs = Array.from(messagesContainerRef.current.querySelectorAll('img'))

    let cancelled = false
    const fallback = setTimeout(() => { if (!cancelled) setVisible(true) }, 3000)

    Promise.all(imgs.map(img => img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
      .then(() => { if (!cancelled) { clearTimeout(fallback); setVisible(true) } })

    return () => { cancelled = true; clearTimeout(fallback) }
  }, [contentReady])

  // Scroll to bottom synchronously before the first paint of the revealed messages.
  // Also sync isAtBottomRef so the ResizeObserver re-pins correctly if slow images
  // finish loading after the reveal (fallback timer or very late network responses).
  useLayoutEffect(() => {
    if (visible) {
      isAtBottomRef.current = true
      setIsAtBottom(true)
      scrollToBottom()
    }
  }, [visible])

  // Re-pin to bottom as images in new realtime messages load after initial reveal.
  useEffect(() => {
    if (!visible || !messagesContainerRef.current) return
    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current && !preserveScrollRef.current) scrollToBottom()
    })
    observer.observe(messagesContainerRef.current)
    return () => observer.disconnect()
  }, [visible])

  // Re-pin to bottom when returning from background if we were at the bottom.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        wasAtBottomRef.current = isAtBottomRef.current
      } else if (document.visibilityState === 'visible' && wasAtBottomRef.current) {
        requestAnimationFrame(scrollToBottom)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

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
      clearTimeout(typingTimeoutRef.current)
      supabase.removeChannel(channel)
      presenceChannelRef.current = null
    }
  }, [convId, displayName])

  useLayoutEffect(() => {
    if (!scrollRef.current) return
    if (preserveScrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight - preserveScrollRef.current
      preserveScrollRef.current = null
      return
    }
    if (visible && isAtBottomRef.current) {
      scrollToBottom()
    }
  }, [messages])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && searchOpen) { setSearchOpen(false); setSearchQuery('') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [searchOpen])




  useEffect(() => {
    if (!selectedMsgId && !confirmDeleteId) return
    function clear() { setSelectedMsgId(null); setConfirmDeleteId(null) }
    document.addEventListener('click', clear)
    return () => document.removeEventListener('click', clear)
  }, [selectedMsgId, confirmDeleteId])

  // ── Scroll ────────────────────────────────────────────────────────────────
  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    setIsAtBottom(atBottom)
    isAtBottomRef.current = atBottom
    if (atBottom) {
      const now = new Date().toISOString()
      localStorage.setItem(READ_AT_KEY(convId), now)
      if (unreadCount > 0) {
        setUnreadCount(0)
        supabase.from('conversation_members')
          .update({ last_read_at: now })
          .eq('conversation_id', convId).eq('user_id', myId).then(() => {})
      }
      if (firstUnreadId) setFirstUnreadId(null)
    }
    // Dismiss unread pill once user has scrolled up to see those messages
    if (firstUnreadId) {
      const msgEl = document.getElementById(`msg-${firstUnreadId}`)
      if (msgEl) {
        const containerRect = el.getBoundingClientRect()
        const msgRect = msgEl.getBoundingClientRect()
        if (msgRect.top < containerRect.bottom) setFirstUnreadId(null)
      }
    }
    if (el.scrollTop < 60 && hasMore && !loadingMore && !atBottom) loadMore()
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
      supabase
        .from('reactions')
        .select('id, message_id, emoji, user_id')
        .in('message_id', older.map(m => m.id))
        .then(({ data: rxData }) => {
          if (!rxData?.length) return
          setReactions(prev => {
            const next = { ...prev }
            for (const r of rxData) {
              if (!next[r.message_id]) next[r.message_id] = {}
              if (!next[r.message_id][r.emoji]) next[r.message_id][r.emoji] = []
              if (!next[r.message_id][r.emoji].some(x => x.id === r.id))
                next[r.message_id][r.emoji] = [...next[r.message_id][r.emoji], r]
            }
            return next
          })
        })
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
    const val = e.target.value
    setText(val)
    if (val) localStorage.setItem(DRAFT_KEY(convId), val)
    else localStorage.removeItem(DRAFT_KEY(convId))
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
    if (sendingRef.current) return
    const trimmed = text.trim()
    if (!trimmed && imagePreviews.length === 0) return
    clearTimeout(typingTimeoutRef.current)
    presenceChannelRef.current?.track({ display_name: displayName, typing: false })

    const replyId = replyingTo?.id ?? null
    const replyMsg = replyingTo
      ? { id: replyingTo.id, body: replyingTo.body, display_name: replyingTo.display_name, image_url: replyingTo.image_url }
      : null
    setReplyingTo(null)

    if (imagePreviews.length > 0) {
      const captured = [...imagePreviews]
      const capturedText = trimmed || null
      const now = Date.now()
      const tempMessages = captured.map((preview, i) => ({
        _tempId: `temp-${now}-${i}`,
        _pending: true,
        _file: preview.file,
        _textBody: null,
        id: `temp-${now}-${i}`,
        conversation_id: convId,
        user_id: myId,
        display_name: displayName || 'Member',
        body: null,
        image_url: preview.previewUrl,
        reply_to_id: i === 0 ? replyId : null,
        reply_message: i === 0 ? replyMsg : null,
        created_at: new Date(now + i).toISOString(),
        _isNew: true,
      }))
      sendingRef.current = true
      setIsAtBottom(true)
      isAtBottomRef.current = true
      setMessages(prev => [...prev, ...tempMessages])
      setText('')
      localStorage.removeItem(DRAFT_KEY(convId))
      setImagePreviews([])
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      sendImages(tempMessages, capturedText).finally(() => { sendingRef.current = false })
      return
    }

    sendingRef.current = true
    setSending(true)
    try {
      const { data: newMsg } = await supabase.from('messages').insert({
        community_group_id: groupId,
        conversation_id: convId,
        user_id: myId,
        display_name: displayName || 'Member',
        body: trimmed,
        image_url: null,
        reply_to_id: replyId,
      }).select('*, reply_message:reply_to_id(id, body, display_name, image_url)').single()
      if (newMsg) {
        setIsAtBottom(true)
        isAtBottomRef.current = true
        setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, { ...newMsg, _isNew: true }])
      }
      trackEvent('chat_message_sent', { type: 'text', conv_type: conversation.type })
      setText('')
      localStorage.removeItem(DRAFT_KEY(convId))
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } catch (err) {
      console.error('Send failed:', err)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  async function sendImages(tempMessages, textBody) {
    await Promise.all(tempMessages.map(temp =>
      sendImage(temp._tempId, temp._file, temp.image_url, temp.reply_to_id, null)
    ))
    if (textBody) {
      const { data: textMsg } = await supabase.from('messages').insert({
        community_group_id: groupId,
        conversation_id: convId,
        user_id: myId,
        display_name: displayName || 'Member',
        body: textBody,
        image_url: null,
        reply_to_id: null,
      }).select('*, reply_message:reply_to_id(id, body, display_name, image_url)').single()
      if (textMsg) {
        setMessages(prev => prev.some(m => m.id === textMsg.id) ? prev : [...prev, { ...textMsg, _isNew: true }])
      }
    }
  }

  function compressImage(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return Promise.resolve(file)
    return new Promise(resolve => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        const MAX = 1200
        const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          blob => resolve(blob
            ? new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
            : file),
          'image/jpeg', 0.82
        )
      }
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
      img.src = url
    })
  }


  async function sendImage(tempId, file, previewUrl, replyId, textBody = null) {
    try {
      const compressed = await compressImage(file)
      const ext = compressed.name.split('.').pop()
      const path = `${myId}/${convId}_${Date.now()}.${ext}`
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('chat-images')
        .upload(path, compressed, { contentType: compressed.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(uploaded.path)

      const { data: newMsg } = await supabase.from('messages').insert({
        community_group_id: groupId,
        conversation_id: convId,
        user_id: myId,
        display_name: displayName || 'Member',
        body: null,
        image_url: publicUrl,
        reply_to_id: replyId,
      }).select('*, reply_message:reply_to_id(id, body, display_name, image_url)').single()

      if (newMsg) {
        trackEvent('chat_message_sent', { type: 'image', conv_type: conversation.type })
        await new Promise(resolve => {
          const img = new window.Image()
          img.onload = resolve
          img.onerror = resolve
          img.src = publicUrl
        })
        setMessages(prev => {
          const without = prev.filter(m => m._tempId !== tempId)
          return without.some(m => m.id === newMsg.id) ? without : [...without, { ...newMsg, _isNew: true }]
        })

      }
    } catch (err) {
      console.error('Image send failed:', err)
      setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _pending: false, _failed: true } : m))
    }
  }

  async function retryMessage(tempId) {
    const msg = messages.find(m => m._tempId === tempId)
    if (!msg?._file) return
    setMessages(prev => prev.map(m => m._tempId === tempId ? { ...m, _pending: true, _failed: false } : m))
    sendImage(tempId, msg._file, msg.image_url, msg.reply_to_id, msg._textBody ?? null)
  }

  function closeReactionPicker() {
    setReactionPickerClosing(true)
    setTimeout(() => { setShowMoreEmojis(false); setReactionPickerClosing(false) }, 250)
  }

  function closeEmojiPicker() {
    setEmojiPickerClosing(true)
    setTimeout(() => { setShowEmojiPicker(false); setEmojiPickerClosing(false) }, 200)
  }

  function insertEmoji(emoji) {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart ?? text.length
    const end = el.selectionEnd ?? text.length
    const newText = text.slice(0, start) + emoji + text.slice(end)
    setText(newText)
    closeEmojiPicker()
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    for (const file of files) {
      if (!file.type.startsWith('image/')) { toast('Only image files are supported', 'error'); continue }
      if (file.size > 10 * 1024 * 1024) { toast('Image must be under 10 MB', 'error'); continue }
      const reader = new FileReader()
      reader.onload = ev => setImagePreviews(prev => [...prev, { file, previewUrl: ev.target.result }])
      reader.readAsDataURL(file)
    }
  }

  // ── Reactions ─────────────────────────────────────────────────────────────
  async function toggleReaction(messageId, emoji) {
    const existing = reactions[messageId]?.[emoji]?.find(r => r.user_id === myId)
    haptic()
    closeMenu()
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
    setConfirmDeleteMsg(false); closeMenu()
    const original = messages.find(m => m.id === msgId)
    setMessages(prev => prev.filter(m => m.id !== msgId))
    const { error } = await supabase.from('messages').delete().eq('id', msgId)
    if (error) {
      if (original) setMessages(prev => [...prev, original].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
      toast('Failed to delete message', 'error')
      return
    }
    if (original?.image_url) {
      const path = original.image_url.split('/chat-images/')[1]
      if (path) await supabase.storage.from('chat-images').remove([path])
    }
  }

  // ── Action menu ───────────────────────────────────────────────────────────
  function openMenuFromEl(el, msgId, isOwn) {
    resetMenuClosing()
    const rect = el.getBoundingClientRect()
    setMenuPos({
      bottom: Math.min(window.innerHeight - rect.top + 8, window.innerHeight - 72),
      ...(isOwn ? { right: Math.max(8, window.innerWidth - rect.right) } : {}),
    })
    setActiveMsg(msgId)
    setShowMoreEmojis(false)
    setReactionPickerClosing(false)
  }

  function exitEdit() {
    const id = editingMsgId
    if (!id) return
    setEditingMsgId(null)
    setEditClosingId(id)
    setTimeout(() => setEditClosingId(prev => prev === id ? null : prev), 280)
  }

  function openMenu(e, msgId, isOwn) {
    e.preventDefault?.()
    openMenuFromEl(e.currentTarget, msgId, isOwn)
  }

  function handleDoubleTap(e, msgId, isOwn) {
    if (e.target.closest('button, a')) return
    if (longPressFiredRef.current) { longPressFiredRef.current = false; return }
    const now = Date.now()
    const last = lastTapRef.current
    if (last && last.msgId === msgId && now - last.time < 300) {
      lastTapRef.current = null
      if (isOwn) {
        e.stopPropagation()
        setSelectedMsgId(prev => prev === msgId ? null : msgId)
      } else {
        openMenuFromEl(e.currentTarget, msgId, isOwn)
      }
    } else {
      lastTapRef.current = { time: now, msgId }
      setSelectedMsgId(null)
      setConfirmDeleteId(null)
    }
  }

  function handleLongPressStart(e, msgId, isOwn) {
    if (e.target.closest('button, a')) return
    const el = e.currentTarget
    longPressFiredRef.current = false
    longPressRef.current = setTimeout(() => {
      longPressRef.current = null
      longPressFiredRef.current = true
      lastTapRef.current = null
      window.getSelection()?.removeAllRanges()
      if (isOwn) {
        setSelectedMsgId(prev => prev === msgId ? null : msgId)
        setConfirmDeleteId(null)
      } else {
        openMenuFromEl(el, msgId, isOwn)
      }
    }, 500)
  }

  function handleLongPressEnd() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  function startEdit(msgId) {
    const msg = messages.find(m => m.id === msgId)
    if (!msg?.body) return
    setEditingMsgId(msgId)
    setEditText(msg.body)
    closeMenu()
    setTimeout(() => {
      const el = editTextareaRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
      el.focus()
    }, 50)
  }

  async function handleSaveEdit(e) {
    e?.preventDefault()
    const original = messages.find(m => m.id === editingMsgId)?.body
    if (!editText.trim() || editText.trim() === original) { exitEdit(); return }
    const id = editingMsgId
    exitEdit()
    const { error } = await supabase.from('messages').update({ body: editText.trim() }).eq('id', id)
    if (!error) setMessages(prev => prev.map(m => m.id === id ? { ...m, body: editText.trim(), _edited: true } : m))
    else toast('Failed to edit message', 'error')
  }

  function handleReply(msgId) {
    const msg = messages.find(m => m.id === msgId)
    if (msg) {
      setReplyingTo(msg)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
    closeMenu()
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

  const readersAtMessage = useMemo(() => {
    const map = {}
    for (const [userId, lastReadAt] of Object.entries(memberReadTimes)) {
      if (!lastReadAt) continue
      const readTime = new Date(lastReadAt)
      let lastReadMsgId = null
      for (let i = filteredMsgs.length - 1; i >= 0; i--) {
        const m = filteredMsgs[i]
        if (!m._tempId && new Date(m.created_at) <= readTime) { lastReadMsgId = m.id; break }
      }
      if (lastReadMsgId) {
        if (!map[lastReadMsgId]) map[lastReadMsgId] = []
        const member = members.find(m => m.user_id === userId)
        if (member) map[lastReadMsgId].push(member)
      }
    }
    return map
  }, [memberReadTimes, filteredMsgs, members])

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

      {/* Unread pill */}
      {firstUnreadId && !searchOpen && (
        <div className="shrink-0 flex justify-center py-1.5 animate-overlay-in">
          <button
            onClick={() => {
              document.getElementById(`msg-${firstUnreadId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              setFirstUnreadId(null)
            }}
            className="flex items-center gap-1.5 bg-jade text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md"
          >
            <ArrowUp size={12} weight="bold" />
            {openUnreadCount} new message{openUnreadCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4 max-w-3xl mx-auto w-full">
        {loadingMore && (
          <div className="flex justify-center py-3">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-stone-300 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Skeleton — shown until images are loaded and we've scrolled to bottom */}
        {!visible && loading && (
          <div className="flex flex-col py-4 gap-3">
            {[
              { side: 'left',  w: 'w-48' },
              { side: 'right', w: 'w-36' },
              { side: 'left',  w: 'w-56' },
              { side: 'left',  w: 'w-40' },
              { side: 'right', w: 'w-52' },
              { side: 'right', w: 'w-32' },
              { side: 'left',  w: 'w-44' },
              { side: 'right', w: 'w-60' },
            ].map((item, i) => (
              <div
                key={i}
                className={`flex items-end gap-2 ${item.side === 'right' ? 'justify-end animate-msg-in-right' : 'justify-start animate-msg-in-left'}`}
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {item.side === 'left' && (
                  <div className="w-7 h-7 rounded-full shrink-0 mb-0.5 overflow-hidden"
                    style={{
                      background: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                      backgroundSize: '200% 100%',
                      animation: `skeleton-shimmer 1.6s ease-in-out infinite`,
                      animationDelay: `${i * 70}ms`,
                    }}
                  />
                )}
                <div
                  className={`${item.w} h-10 rounded-2xl ${item.side === 'right' ? 'rounded-br-sm' : 'rounded-bl-sm'} overflow-hidden`}
                  style={{
                    background: item.side === 'right'
                      ? 'linear-gradient(90deg, rgba(196,98,45,0.12) 25%, rgba(196,98,45,0.25) 50%, rgba(196,98,45,0.12) 75%)'
                      : 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                    backgroundSize: '200% 100%',
                    animation: `skeleton-shimmer 1.6s ease-in-out infinite`,
                    animationDelay: `${i * 70 + 80}ms`,
                  }}
                />
              </div>
            ))}

            {/* Typing indicator */}
            <div className="flex items-end gap-2 animate-msg-in-left" style={{ animationDelay: '620ms' }}>
              <div className="w-7 h-7 rounded-full shrink-0 mb-0.5 overflow-hidden"
                style={{
                  background: 'linear-gradient(90deg, #e7e5e4 25%, #d6d3d1 50%, #e7e5e4 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'skeleton-shimmer 1.6s ease-in-out infinite',
                  animationDelay: '700ms',
                }}
              />
              <div className="flex items-center gap-1 bg-stone-100 rounded-2xl rounded-bl-sm px-3.5 py-3">
                {[0, 1, 2].map(j => (
                  <div
                    key={j}
                    className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-dot-bounce"
                    style={{ animationDelay: `${j * 180}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Messages — rendered hidden when contentReady so images load in background,
            then revealed after scroll-to-bottom via the visible flag */}
        {contentReady && !loading && (
          filteredMsgs.length === 0 ? (
            visible && (
              <div className="flex flex-col items-center justify-center h-full py-16 text-stone-400">
                {searchQuery ? (
                  <>
                    <MagnifyingGlass size={40} className="text-stone-300 mb-3" />
                    <p className="text-sm">No messages match &ldquo;{searchQuery}&rdquo;</p>
                  </>
                ) : (
                  <p className="text-sm">No messages yet. Say hello!</p>
                )}
              </div>
            )
          ) : (
          <div
            ref={messagesContainerRef}
            className="space-y-0.5 py-2 pb-4"
            style={!visible ? { height: 0, overflow: 'hidden' } : {}}
          >
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
              const isLastInGroup  = nextItem?.type !== 'msg' || nextItem.msg.user_id !== msg.user_id || new Date(nextItem.msg.created_at) - new Date(msg.created_at) > GROUP_TIME_GAP
              const isFirstInGroup = prevItem?.type !== 'msg' || prevItem.msg.user_id !== msg.user_id || new Date(msg.created_at) - new Date(prevItem.msg.created_at) > GROUP_TIME_GAP
              const msgReactions = reactions[msg.id]
              const hasReactions = msgReactions && Object.keys(msgReactions).length > 0

              return (
                <div
                  id={`msg-${msg.id}`}
                  key={msg.id}
                  className={`flex gap-2 select-none ${isOwn ? 'justify-end' : 'justify-start'} ${isLastInGroup && !hasReactions ? 'mb-2' : 'mb-0'}`}
                  onContextMenu={e => { if (msg._pending || msg._failed) return; e.preventDefault(); openMenu(e, msg.id, isOwn) }}
                  onClick={e => { if (msg._pending || msg._failed) return; handleDoubleTap(e, msg.id, isOwn) }}
                  onTouchStart={e => { if (msg._pending || msg._failed) return; handleLongPressStart(e, msg.id, isOwn) }}
                  onTouchEnd={handleLongPressEnd}
                  onTouchMove={handleLongPressEnd}
                >
                  {isOwn && selectedMsgId === msg.id && !editingMsgId && (
                    <div className="self-center flex items-center gap-2 animate-overlay-in">
                      {msg.body && (
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedMsgId(null); startEdit(msg.id) }}
                          className="w-11 h-11 rounded-full bg-stone-100 border border-stone-200 text-stone-500 hover:text-stone-700 hover:bg-stone-200 flex items-center justify-center shrink-0 transition-colors"
                        >
                          <PencilSimple size={17} weight="bold" />
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); setSelectedMsgId(null); setConfirmDeleteId(msg.id) }}
                        className="w-11 h-11 rounded-full bg-red-50 border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-100 flex items-center justify-center shrink-0 transition-colors"
                      >
                        <Trash size={17} weight="fill" />
                      </button>
                    </div>
                  )}
                  {isOwn && confirmDeleteId === msg.id && (
                    <div className="self-center flex items-center gap-2 animate-overlay-in">
                      <span className="text-xs text-stone-400 whitespace-nowrap">Delete?</span>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                        className="text-sm text-stone-400 hover:text-stone-600 font-medium px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 transition-colors"
                      >
                        No
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null); deleteMessage(msg.id) }}
                        className="text-sm text-white bg-red-500 hover:bg-red-600 font-medium px-3 py-2 rounded-xl transition-colors"
                      >
                        Yes
                      </button>
                    </div>
                  )}
                  {!isOwn && (
                    <div className="w-8 shrink-0 self-start mt-1">
                      {isFirstInGroup && <Initials name={senderName(msg.user_id, msg.display_name)} userId={msg.user_id} icon={members.find(m => m.user_id === msg.user_id)?.avatar_icon} colorKey={members.find(m => m.user_id === msg.user_id)?.avatar_color} />}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} ${msg._isNew ? (isOwn ? 'animate-msg-in-right' : 'animate-msg-in-left') : ''}`}>
                    {!isOwn && isFirstInGroup && (
                      <p className="text-xs font-semibold text-stone-500 mb-1 ml-1">{senderName(msg.user_id, msg.display_name)}</p>
                    )}
                    <div className="relative">
                    <div className={`overflow-hidden select-none transition-colors duration-200
                      ${editingMsgId === msg.id ? 'animate-edit-pop' : editClosingId === msg.id ? 'animate-edit-close' : ''}
                      ${isOwn
                        ? `${editingMsgId === msg.id ? 'bg-stone-600' : 'bg-jade'} text-white ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? `rounded-bl-2xl ${msg.image_url ? 'rounded-br-sm' : 'rounded-br-none'}` : 'rounded-b-md'}`
                        : `bg-white border border-stone-200 text-stone-800 ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? `rounded-br-2xl ${msg.image_url ? 'rounded-bl-sm' : 'rounded-bl-none'}` : 'rounded-b-md'}`
                      }`}>
                      {/* Reply quote */}
                      {msg.reply_message && (
                        <button
                          onClick={() => scrollToMessage(msg.reply_message.id)}
                          className={`w-full text-left mx-0 px-3 pt-2.5 pb-1.5 border-b ${isOwn ? 'border-white/20' : 'border-stone-100'}`}
                        >
                          <div className={`pl-2 border-l-2 ${isOwn ? 'border-white/60' : 'border-jade'}`}>
                            <p className={`text-[11px] font-semibold truncate ${isOwn ? 'text-white/90' : 'text-jade'}`}>
                              {senderName(msg.reply_message.user_id, msg.reply_message.display_name)}
                            </p>
                            <p className={`text-[11px] truncate ${isOwn ? 'text-white/70' : 'text-stone-500'}`}>
                              {msg.reply_message.image_url && !msg.reply_message.body ? '📷 Photo' : msg.reply_message.body}
                            </p>
                          </div>
                        </button>
                      )}
                      {msg.image_url && (
                        msg._pending || msg._failed ? (
                          <div className="relative">
                            <img src={msg.image_url} alt="shared" className="block max-w-full" style={{ maxHeight: 280 }} width="400" height="280" loading="lazy" />
                            {msg._pending && (
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
                              </div>
                            )}
                            {msg._failed && (
                              <button
                                className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1.5 w-full"
                                onClick={e => { e.stopPropagation(); retryMessage(msg._tempId) }}
                              >
                                <X size={22} className="text-white" weight="bold" />
                                <span className="text-white text-xs font-medium">Tap to retry</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <img
                            src={msg.image_url}
                            alt="shared"
                            draggable={false}
                            className="block max-w-full cursor-pointer"
                            style={{ maxHeight: 280, WebkitTouchCallout: 'none' }}
                            onContextMenu={e => e.preventDefault()}
                            onClick={e => {
                              e.stopPropagation()
                              const now = Date.now()
                              const last = imgTapRef.current
                              if (last && last.msgId === msg.id && now - last.time < 350) {
                                clearTimeout(last.timer)
                                imgTapRef.current = null
                                if (isOwn) setSelectedMsgId(prev => prev === msg.id ? null : msg.id)
                                else openMenuFromEl(e.currentTarget, msg.id, false)
                              } else {
                                clearTimeout(last?.timer)
                                const timer = setTimeout(() => {
                                  imgTapRef.current = null
                                  setLightboxImg(msg.image_url)
                                }, 310)
                                imgTapRef.current = { msgId: msg.id, time: now, timer }
                              }
                            }}
                          />
                        )
                      )}
                      {editingMsgId === msg.id ? (
                        <form onSubmit={handleSaveEdit} className="px-3 py-2 animate-overlay-in">
                          <textarea
                            ref={editTextareaRef}
                            value={editText}
                            onChange={e => {
                              setEditText(e.target.value)
                              e.target.style.height = 'auto'
                              e.target.style.height = e.target.scrollHeight + 'px'
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(e) }
                              if (e.key === 'Escape') exitEdit()
                            }}
                            rows={1}
                            className="w-full text-sm bg-transparent border-0 outline-none text-white resize-none placeholder:text-white/50"
                            style={{ minWidth: 140 }}
                          />
                          <div className="flex gap-3 mt-1.5">
                            <button type="button" onClick={exitEdit} className="text-[11px] text-white/60 hover:text-white font-medium transition-colors">
                              Cancel
                            </button>
                            <button type="submit" disabled={!editText.trim()} className="text-[11px] text-white font-semibold disabled:opacity-40 transition-opacity">
                              Save
                            </button>
                          </div>
                        </form>
                      ) : msg.body && (
                        <p className={`px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${editClosingId === msg.id ? 'animate-overlay-in' : ''}`}>
                          {renderMessageBody(msg.body, searchQuery)}
                        </p>
                      )}
                    </div>
                    {isLastInGroup && isOwn && !msg.image_url && (
                      <svg className="absolute bottom-0 -right-[9px] pointer-events-none" width="9" height="12" viewBox="0 0 9 12" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 0 0 C 0 10 9 10 9 12 L 0 12 Z" fill={editingMsgId === msg.id ? '#57534e' : '#C4622D'} />
                      </svg>
                    )}
                    {isLastInGroup && !isOwn && !msg.image_url && (
                      <svg className="absolute bottom-0 -left-[9px] pointer-events-none" width="9" height="12" viewBox="0 0 9 12" xmlns="http://www.w3.org/2000/svg">
                        <path d="M 9 0 C 9 10 0 10 0 12 L 9 12 Z" fill="white" />
                        <path d="M 9 0 C 9 10 0 10 0 12" fill="none" stroke="#e7e5e4" strokeWidth="1" />
                      </svg>
                    )}
                    </div>

                    {isLastInGroup && (
                      <p className={`text-[10px] mt-1 ${isOwn ? 'mr-1' : 'ml-1'} ${msg._failed ? 'text-red-400' : 'text-stone-400'}`}>
                        {msg._pending ? 'Sending…' : msg._failed ? 'Failed to send' : formatMessageTime(msg.created_at)}
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
                    {isOwn && readersAtMessage[msg.id]?.length > 0 && (
                      <div className="flex gap-0.5 mt-1 justify-end">
                        {readersAtMessage[msg.id].slice(0, 6).map(member => (
                          <div
                            key={member.user_id}
                            title={member.display_name}
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${avatarColor(member.user_id, member.avatar_color)}`}
                          >
                            {member.avatar_icon
                              ? <AvatarIcon name={member.avatar_icon} size={9} />
                              : <span className="text-white text-[8px] font-bold leading-none">{initials(member.display_name)}</span>
                            }
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          )
        )}

        {fetchingFresh && (
          <div className="flex justify-center py-3">
            <div className="w-4 h-4 rounded-full border-2 border-stone-200 border-t-stone-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Scroll-to-bottom — floats inside messages area, above typing + input */}
      {!isAtBottom && !searchOpen && (
        <div className="absolute bottom-3 inset-x-0 flex justify-center z-10 animate-overlay-in pointer-events-none">
          <button
            onClick={() => {
              setIsAtBottom(true)
              isAtBottomRef.current = true
              setUnreadCount(0)
              supabase.from('conversation_members')
                .update({ last_read_at: new Date().toISOString() })
                .eq('conversation_id', convId).eq('user_id', myId).then(() => {})
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
            }}
            className="pointer-events-auto relative w-9 h-9 bg-jade text-white rounded-full shadow-lg flex items-center justify-center"
          >
            <ArrowDown size={16} weight="bold" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      )}
      </div>

      {/* Typing indicator */}
      {typing && (
        <div className="shrink-0 px-4 pb-2 max-w-3xl mx-auto w-full animate-overlay-in">
          <span className="text-[11px] text-stone-400 ml-1 block mb-1">{typing}</span>
          <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-none px-3 py-2.5 inline-flex items-center gap-1 shadow-sm">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-stone-200 bg-white px-4 pt-3 pb-3 max-w-3xl mx-auto w-full">
        {/* Reply preview */}
        {replyingTo && (
          <div className="flex items-center gap-2 bg-jade/5 border border-jade/20 rounded-xl px-3 py-2 mb-2">
            <div className="w-0.5 self-stretch bg-jade rounded-full shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-jade truncate">{senderName(replyingTo.user_id, replyingTo.display_name)}</p>
              <p className="text-xs text-stone-400 truncate">
                {replyingTo.image_url && !replyingTo.body ? '📷 Photo' : replyingTo.body}
              </p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-stone-400 hover:text-stone-600 shrink-0">
              <X size={14} weight="bold" />
            </button>
          </div>
        )}
        {imagePreviews.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pt-2 pb-0.5">
            {imagePreviews.map((preview, i) => (
              <div key={preview.previewUrl} className="relative shrink-0">
                <img src={preview.previewUrl} alt="preview" className="h-20 w-20 object-cover rounded-xl border border-stone-200" />
                <button
                  onClick={() => setImagePreviews(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-600 text-white rounded-full flex items-center justify-center"
                >
                  <X size={10} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        )}
        {(showEmojiPicker || emojiPickerClosing) && (
          <div className={`mb-2 ${emojiPickerClosing ? 'animate-overlay-out' : 'animate-stack-in'}`}>
            <EmojiPicker
              onEmojiClick={emojiData => insertEmoji(emojiData.emoji)}
              width="100%"
              height={350}
              searchPlaceholder="Search emojis…"
              previewConfig={{ showPreview: false }}
              autoFocusSearch={false}
            />
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-jade hover:bg-stone-100 transition-colors shrink-0"
          >
            <ImageIcon size={22} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
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
            type="button"
            onClick={() => showEmojiPicker ? closeEmojiPicker() : setShowEmojiPicker(true)}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors shrink-0 ${showEmojiPicker ? 'text-jade bg-jade/10' : 'text-stone-400 hover:text-jade hover:bg-stone-100'}`}
          >
            <Smiley size={22} />
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || (!text.trim() && imagePreviews.length === 0)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-jade text-white hover:bg-jade-700 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </div>
      </div>

      {/* Action menu */}
      {activeMsg && menuPos && (
        <>
        <div className="fixed inset-0 z-[29] select-none" onTouchStart={e => { e.preventDefault(); closeMenu() }} onClick={closeMenu} />
        <div
          className="fixed z-30"
          style={{ bottom: menuPos.bottom, ...('right' in menuPos ? { right: menuPos.right } : { left: '50%', transform: 'translateX(-50%)' }) }}
        >
        <div className={`bg-white rounded-2xl shadow-xl border border-stone-100 p-1.5 ${menuClosing ? 'animate-popup-out' : 'animate-popup-in'}`}>
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
              onClick={() => showMoreEmojis ? closeReactionPicker() : setShowMoreEmojis(true)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${showMoreEmojis ? 'bg-jade text-white' : 'text-stone-400 hover:bg-stone-100'}`}
            >
              {showMoreEmojis ? '×' : '+'}
            </button>
            <div className="w-px h-6 bg-stone-100 mx-0.5" />
            {activeMessage?.body && (
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(activeMessage.body)
                  closeMenu()
                  toast('Copied', 'success')
                }}
                className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
              >
                <Copy size={14} weight="bold" />
              </button>
            )}
            <button
              onClick={() => handleReply(activeMsg)}
              className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-500 hover:text-stone-700 transition-colors"
            >
              <ArrowBendUpLeft size={15} weight="bold" />
            </button>
            {activeMessage?.user_id === myId && (
              <>
                <div className="w-px h-6 bg-stone-100 mx-0.5" />
                {activeMessage?.body && (
                  <button
                    onClick={() => startEdit(activeMsg)}
                    className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    <PencilSimple size={14} weight="bold" />
                  </button>
                )}
                <button
                  onClick={() => setConfirmDeleteMsg(true)}
                  className="w-9 h-9 rounded-xl hover:bg-red-50 flex items-center justify-center text-stone-400 hover:text-red-500 transition-colors"
                >
                  <Trash size={14} weight="bold" />
                </button>
              </>
            )}
          </div>
          {confirmDeleteMsg && (
            <div className="flex items-center gap-2 mt-1 pt-1.5 border-t border-stone-100 px-1">
              <span className="text-xs text-stone-500 flex-1">Delete message?</span>
              <button
                onClick={() => setConfirmDeleteMsg(false)}
                className="text-xs text-stone-400 hover:text-stone-600 font-medium px-2 py-1 rounded-lg hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMessage(activeMsg)}
                className="text-xs text-white bg-red-500 hover:bg-red-600 font-medium px-2 py-1 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          )}
        </div>
        </div>
        </>
      )}

      {(showMoreEmojis || reactionPickerClosing) && activeMsg && (
        <>
          <div className="fixed inset-0 z-[39]" style={{ cursor: 'pointer' }} onClick={closeReactionPicker} />
          <div className={`fixed inset-x-0 bottom-0 z-40 bg-white border-t border-stone-100 shadow-xl ${reactionPickerClosing ? 'animate-modal-out' : 'animate-modal-in'}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)', overscrollBehavior: 'contain' }}>
            <EmojiPicker
              onEmojiClick={emojiData => toggleReaction(activeMsg, emojiData.emoji)}
              width="100%"
              height={350}
              searchPlaceholder="Search emojis…"
              previewConfig={{ showPreview: false }}
              autoFocusSearch={false}
            />
          </div>
        </>
      )}

      {activeMsg && (
        <div className="fixed inset-0 z-20" onClick={closeMenu} />
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
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-3 ${conversation.type === 'group' ? 'bg-jade' : avatarColor(dmOtherMember?.user_id ?? '', dmOtherMember?.avatar_color)}`}>
                {conversation.type === 'group'
                  ? <Users size={40} weight="fill" className="text-white" />
                  : dmOtherMember?.avatar_icon
                    ? <AvatarIcon name={dmOtherMember.avatar_icon} size={40} />
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
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${avatarColor(m.user_id, m.avatar_color)}`}>
                        {m.avatar_icon
                          ? <AvatarIcon name={m.avatar_icon} size={20} />
                          : <span className="text-white text-sm font-bold">{initials(m.display_name)}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-stone-800 truncate">{m.display_name}</span>
                          {m.role === 'admin' && (
                            <ShieldCheck size={12} weight="fill" className="text-jade shrink-0" />
                          )}
                          {m.user_id === myId && (
                            <span className="text-stone-400 text-xs shrink-0">(You)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {notesOpen && <NotesModal groupId={groupId} onClose={() => setNotesOpen(false)} />}

      {/* Image lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center animate-overlay-in"
          onClick={() => setLightboxImg(null)}
        >
          <button
            onClick={() => setLightboxImg(null)}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={20} weight="bold" />
          </button>
          <img
            src={lightboxImg}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            style={{ maxHeight: 'calc(100svh - 80px)', maxWidth: 'calc(100vw - 32px)' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
