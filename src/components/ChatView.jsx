import { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
const EmojiPicker = lazy(() => import('emoji-picker-react'))
import {
  X, MagnifyingGlass, ArrowUp, Trash, ArrowLeft, Notepad,
  Users, ArrowBendUpLeft, PencilSimple, Copy,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { useToast } from '../lib/toast.jsx'
import NotesModal from './NotesModal.jsx'
import { AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'
import { initials, GROUP_TIME_GAP, isVideoUrl } from '../utils/format.js'
import { trackEvent } from '../lib/analytics.js'
import { ChatContext, ChatInputContext } from './chat/ChatContext.jsx'
import MessageList from './chat/MessageList.jsx'
import MessageInput from './chat/MessageInput.jsx'
import ConversationInfo from './chat/ConversationInfo.jsx'
import { useReactionHandlers } from '../hooks/useReactionHandlers.js'
import { useImageUpload } from '../hooks/useImageUpload.js'
import { usePollActions } from '../hooks/usePollActions.js'

const PAGE_SIZE   = 50
const CACHE_LIMIT = 50
const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']
const DRAFT_KEY    = convId => `draft:${convId}`
const READ_AT_KEY  = convId => `readAt:${convId}`
const CACHE_KEY    = convId => `chat_v1_${convId}`

// Behavior thresholds
const AT_BOTTOM_THRESHOLD = 20    // px from bottom to consider "at bottom"
const KEYBOARD_THRESHOLD  = 120   // px viewport shrink to detect keyboard open
const DOUBLE_TAP_MS       = 300   // ms window for double-tap detection
const LONG_PRESS_MS       = 500   // ms to trigger long press
const TYPING_STOP_MS      = 3000  // ms idle before typing indicator clears
const FOCUS_DELAY_MS      = 50    // ms delay before programmatic focus

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


function dateSeparatorLabel(iso) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function typingLabel(users) {
  if (!users.length) return ''
  if (users.length === 1) return `${users[0]} is typing…`
  if (users.length === 2) return `${users[0]} and ${users[1]} are typing…`
  return `${users.length} people are typing…`
}

function formatEventDate(dateStr, timeStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const mon = months[d.getMonth()]
  const day = d.getDate()
  if (!timeStr) return `${mon} ${day}`
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  const mins = m === 0 ? '' : `:${String(m).padStart(2, '0')}`
  return `${mon} ${day} · ${hour12}${mins} ${suffix}`
}

export default function ChatView({ conversation, session, displayName, groupId, members, isAdmin, exiting, onBack, onRead, openedWithLastReadAt = null, otherUnreadCount = 0 }) {
  const [messages, setMessages]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [hasMore, setHasMore]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [text, setText]                 = useState(() => localStorage.getItem(DRAFT_KEY(conversation.id)) ?? '')
  const [sending, setSending]           = useState(false)
  const [searchOpen, setSearchOpen]     = useState(false)
  const [searchQuery, setSearchQuery]   = useState('')
  const [isAtBottom, setIsAtBottom]     = useState(true)
  const [typingUsers, setTypingUsers]   = useState([])
  const [activeMsg, setActiveMsg]       = useState(null)
  const [menuPos, setMenuPos]           = useState(null)
  const [showMoreEmojis, setShowMoreEmojis] = useState(false)
  const [reactionPickerClosing, setReactionPickerClosing] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
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
  const [convName, setConvName]             = useState(conversation.name)
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
  const [lightboxClosing, setLightboxClosing] = useState(false)
  const [typingClosing, setTypingClosing]     = useState(false)
  const [pillClosing, setPillClosing]         = useState(false)
  const [convImageUrl, setConvImageUrl]       = useState(conversation.image_url ?? null)
  const [mentionSearch, setMentionSearch]     = useState(null)

  const scrollRef          = useRef(null)
  const editTextareaRef    = useRef(null)
  const fileInputRef       = useRef(null)
  const textareaRef        = useRef(null)
  const searchInputRef     = useRef(null)
  const presenceChannelRef = useRef(null)
  const typingTimeoutRef   = useRef(null)
  const typingCloseRef     = useRef(null)
  const lastTapRef         = useRef(null)
  const longPressRef       = useRef(null)
  const longPressFiredRef  = useRef(false)
  const imgTapRef              = useRef(null)
  const lightboxTouchStartY    = useRef(null)
  const preserveScrollRef  = useRef(null)
  const isAtBottomRef              = useRef(true)
  const initialScrollDoneRef       = useRef(false)
  const pendingScrollRef           = useRef(null)

  const freshLoadRef               = useRef(false)
  const freshLoadTimerRef          = useRef(null)
  const mountedRef                 = useRef(true)
  const wasAtBottomRef             = useRef(true)
  const initialRevealScrollNeeded  = useRef(false)
  const initialScrollSettledRef    = useRef(false)
  const initialFirstUnreadRef      = useRef(null)
  const unreadDetectedRef          = useRef(false)
  const messagesContainerRef  = useRef(null)
  // Populated by MessageList after it creates the virtualizer.
  // Used as a fallback when a target message is outside the current overscan window.
  const virtualizerRef        = useRef(null)
  const sendingRef            = useRef(false)
  const savedSelectionRef     = useRef({ start: 0, end: 0 })
  const groupIconFileRef      = useRef(null)
  const headerWrapperRef      = useRef(null)
  const inputWrapperRef       = useRef(null)
  const [headerH, setHeaderH]     = useState(80)
  const [inputH, setInputH]       = useState(72)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; clearTimeout(longPressRef.current) }
  }, [])

  useEffect(() => {
    const el = headerWrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setHeaderH(entry.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = inputWrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setInputH(entry.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const myId = session.user.id
  const convId = conversation.id

  // Stale-safe mirrors for values read inside async callbacks or hook params.
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const convImageUrlRef = useRef(convImageUrl)
  convImageUrlRef.current = convImageUrl

  const { reactions, setReactions, justReacted, toggleReaction } = useReactionHandlers({
    convId, groupId, myId, closeMenu,
  })

  const {
    imagePreviews, setImagePreviews,
    uploadingGroupIcon,
    compressImage, sendImage, sendImages,
    retryMessage, handleFileChange, removePreview,
    uploadGroupIcon, removeGroupIcon,
  } = useImageUpload({
    convId, groupId, myId, displayName,
    conversation, setMessages, messagesRef,
    convImageUrlRef, setConvImageUrl,
    mountedRef, toast,
  })

  const {
    polls, setPolls,
    chatEvents, setChatEvents,
    chatPrayers, setChatPrayers,
    pollCreating, setPollCreating,
    pollQuestion, setPollQuestion,
    pollOptions, setPollOptions,
    pollSubmitting,
    pollMenuOpenId, setPollMenuOpenId,
    deletingPollId,
    editingPollId, setEditingPollId,
    editPollQuestion, setEditPollQuestion,
    editPollOptions, setEditPollOptions,
    savingPoll,
    pollOptionRefs, justAddedOptionRef, pollQuestionRef,
    fetchPollsForMessages, fetchEventsForMessages, fetchPrayerRequestsForMessages,
    prayInChat, rsvpInChat, createPoll, castVote, startEditPoll, savePoll, deletePoll,
  } = usePollActions({
    convId, groupId, myId, displayName, members,
    replyingTo, setReplyingTo,
    setMessages, messagesRef,
    isAtBottomRef, setIsAtBottom,
    freshLoadRef, scrollToBottom,
    mountedRef, toast,
  })

  // Prevent iOS from scrolling the document while chat is open. The outer div has
  // minHeight > dvh (needed for env(safe-area-inset-bottom) to return non-zero), which
  // makes the document technically scrollable. iOS keyboard-open triggers a page scroll
  // to "ensure" the focused input is visible; hiding body overflow blocks that scroll so
  // vv.offsetTop stays 0 and the --vvh formula stays accurate.
  //
  // Measure sab BEFORE setting overflow:hidden. On some iOS versions, applying
  // overflow:hidden to the body causes env(safe-area-inset-bottom) to return 0px
  // (iOS treats the page as non-scrollable and skips safe-area reporting). Pinning
  // --sab to the real JS-measured value keeps the container height formula correct.
  useEffect(() => {
    // Measure env(safe-area-inset-bottom) BEFORE setting overflow:hidden — iOS
    // returns 0 for env() once the body is non-scrollable. We also need to
    // handle iOS PWA: after a SW-triggered reload the viewport hasn't fully
    // initialised yet, so the first measurement can return 0 even without
    // overflow:hidden. We set overflow:hidden immediately (keyboard behaviour
    // needs it from the start) then retry at 100 ms and 300 ms if needed,
    // briefly lifting overflow:hidden so env() can return the real value.
    function measure() {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);width:0;pointer-events:none;visibility:hidden'
      document.documentElement.appendChild(el)
      const px = el.offsetHeight
      el.remove()
      return px
    }

    window.scrollTo(0, 1)

    let cancelled = false
    const initial = measure()
    if (initial > 0) document.documentElement.style.setProperty('--sab', `${initial}px`)
    document.body.style.overflow = 'hidden'

    // If initial measurement returned 0 (viewport not yet initialised after SW
    // reload), retry with overflow:hidden briefly removed so env() can report
    // the real value. `measured` prevents the 300 ms timer from removing
    // overflow:hidden a second time if the 100 ms retry already succeeded.
    if (initial === 0) {
      let measured = false
      const timers = [100, 300].map(delay => setTimeout(() => {
        if (cancelled || measured) return
        document.body.style.overflow = ''
        window.scrollTo(0, 1)
        requestAnimationFrame(() => {
          if (cancelled) return
          const px = measure()
          if (px > 0) {
            document.documentElement.style.setProperty('--sab', `${px}px`)
            measured = true
          }
          if (!cancelled) document.body.style.overflow = 'hidden'
        })
      }, delay))
      return () => {
        cancelled = true
        timers.forEach(clearTimeout)
        document.body.style.overflow = ''
        // --sab is device-constant (34px or 0). Do NOT remove it — App.jsx set it
        // at startup without overflow:hidden and the value persists across chat sessions.
        // Removing it would lose the correct value, forcing a re-probe that races with
        // the async scrollTo(0,1) and frequently returns 0 on subsequent chat opens.
      }
    }

    return () => {
      cancelled = true
      document.body.style.overflow = ''
      // Same: keep --sab pinned. See comment above.
    }
  }, [])

  // Track keyboard visibility via visualViewport. When the keyboard appears,
  // window.innerHeight stays fixed but visualViewport.height shrinks, giving us
  // the exact visible-area height to size the chat container against.
  // This replaces the old focusin/focusout approach which was unreliable —
  // focus can move between inputs without the keyboard closing, leaving the
  // chat-keyboard-open class stuck on or off.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    // Read env(safe-area-inset-top) once in px via a temp element.
    const satEl = document.createElement('div')
    satEl.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);width:0;pointer-events:none;visibility:hidden'
    document.documentElement.appendChild(satEl)
    const sat = satEl.offsetHeight
    satEl.remove()

    // Capture baseline before any keyboard interaction. Using vv.height rather than
    // window.innerHeight because iOS mutates window.innerHeight when the keyboard
    // appears on some versions, which would make kbH ≈ 0 and prevent detection.
    let baseline = Math.round(vv.height)
    let kbOpen = false

    function update() {
      const nowVVH = Math.round(vv.height)
      // Self-correct: if the viewport grew larger than our captured baseline (can
      // happen when ChatView mounts while the previous session's keyboard was still
      // animating away, leaving vv.height temporarily reduced at capture time),
      // update baseline to the new larger value so keyboard detection stays accurate.
      if (!kbOpen && nowVVH > baseline) baseline = nowVVH
      const kbH = baseline - nowVVH
      const nowOpen = kbH > KEYBOARD_THRESHOLD
      // sat + vv.offsetTop + vv.height gives the keyboard top in document
      // coordinates, which is the correct chat container height.
      // vv.offsetTop accounts for any page scroll iOS applies when the keyboard
      // opens, so this formula stays accurate whether or not body overflow:hidden
      // fully prevents that scroll.
      document.documentElement.style.setProperty(
        '--vvh',
        `${Math.round(sat + vv.offsetTop + vv.height)}px`
      )
      if (nowOpen && !kbOpen) {
        kbOpen = true
        document.body.classList.add('chat-keyboard-open')
        setKeyboardOpen(true)
      } else if (!nowOpen && kbOpen) {
        kbOpen = false
        document.body.classList.remove('chat-keyboard-open')
        setKeyboardOpen(false)
        window.scrollTo(0, 0)
      }
    }

    // On iOS PWA resume, iOS may close the keyboard without firing a visualViewport
    // resize event, leaving chat-keyboard-open stuck. Clear the stuck state only
    // when we can confirm the keyboard is closed — don't call update() here because
    // vv.height can briefly report a transitional value during the iOS app-restore
    // animation, which causes a false keyboard-open detection that persists until kill.
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      // Wait one rAF for the viewport to settle before inspecting vv.height.
      requestAnimationFrame(() => {
        if (!kbOpen) return
        const nowVVH = Math.round(vv.height)
        if (baseline - nowVVH <= KEYBOARD_THRESHOLD) {
          // Keyboard is not open — clear the stuck state.
          kbOpen = false
          document.body.classList.remove('chat-keyboard-open')
          document.documentElement.style.removeProperty('--vvh')
          setKeyboardOpen(false)
        }
      })
    }

    // Fallback for iOS PWA builds that intermittently skip visualViewport resize/scroll
    // events on keyboard open. Calling update() 150 ms after any input focus gives
    // iOS enough time to finish updating vv.height before we read it.
    let focusTimer = null
    function onFocusIn(e) {
      if (!['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return
      clearTimeout(focusTimer)
      focusTimer = setTimeout(update, 150)
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('visibilitychange', onVisible)
      clearTimeout(focusTimer)
      document.body.classList.remove('chat-keyboard-open')
      document.documentElement.style.removeProperty('--vvh')
      setKeyboardOpen(false)
    }
  }, [])

  function scrollToBottom() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
    setIsAtBottom(true)
    isAtBottomRef.current = true
    setConvName(conversation.name)
    initialScrollDoneRef.current = false
    pendingScrollRef.current = null
    initialScrollSettledRef.current = false
    initialFirstUnreadRef.current = null
    unreadDetectedRef.current = false
    lastTapRef.current = null
    freshLoadRef.current = true
    clearTimeout(freshLoadTimerRef.current)
    freshLoadTimerRef.current = setTimeout(() => { freshLoadRef.current = false }, 5000)
    setText(localStorage.getItem(DRAFT_KEY(convId)) ?? '')

    const cached = loadCache(convId)
    if (cached?.length) {
      setMessages(cached)
      setHasMore(cached.length >= CACHE_LIMIT)
      setLoading(false)
      setFetchingFresh(true)
      fetchPollsForMessages(cached)
      fetchEventsForMessages(cached)
      fetchPrayerRequestsForMessages(cached)
    } else {
      setLoading(true)
    }

    supabase
      .from('messages')
      .select('*, reply_message:reply_to_id(id, body, display_name, image_url)')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(async ({ data }) => {
        const msgs = (data ?? []).reverse()
        saveCache(convId, msgs)
        setMessages(msgs)
        setHasMore((data ?? []).length === PAGE_SIZE)
        setLoading(false)
        setFetchingFresh(false)
        // After fresh messages commit, ensure scroll stays at the bottom.
        // A single rAF isn't enough: iOS WebKit can restore the inner div's
        // scrollTop asynchronously and override it. We apply scrollToBottom
        // immediately, then watch for any restoration scroll event within
        // 1500ms and correct once more — same pattern as the visibilitychange
        // fix. freshLoadRef guards against firing on paginated loads;
        // initialFirstUnreadRef guards against overriding a deliberate
        // scroll-to-first-unread from the cache path.
        if (freshLoadRef.current && !initialFirstUnreadRef.current) {
          requestAnimationFrame(() => {
            if (mountedRef.current) scrollToBottom()
          })
        }
        if (!msgs.length) return
        const { data: rxData } = await supabase
          .from('reactions')
          .select('id, message_id, emoji, user_id')
          .in('message_id', msgs.map(m => m.id))
        const map = {}
        for (const r of rxData ?? []) {
          if (!map[r.message_id]) map[r.message_id] = {}
          if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = []
          map[r.message_id][r.emoji].push(r)
        }
        setReactions(map)
        fetchPollsForMessages(msgs)
        fetchEventsForMessages(msgs)
        fetchPrayerRequestsForMessages(msgs)
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
          window.requestIdleCallback
            ? window.requestIdleCallback(() => saveCache(convId, updated))
            : setTimeout(() => saveCache(convId, updated), 0)
          return updated
        })
        if (msg.poll_id) fetchPollsForMessages([msg])
        if (msg.event_id) fetchEventsForMessages([msg])
        if (msg.prayer_request_id) fetchPrayerRequestsForMessages([msg])
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
        filter: `conversation_id=eq.${convId}`,
      }, ({ old: msg }) => {
        setMessages(prev => prev.filter(m => m.id !== msg.id))
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

    const convMetaCh = supabase
      .channel(`conv-meta:${convId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'conversations',
        filter: `id=eq.${convId}`,
      }, ({ new: conv }) => {
        setConvName(conv.name ?? null)
        setConvImageUrl(conv.image_url ?? null)
      })
      .subscribe()

    const eventRsvpsCh = supabase
      .channel(`event-rsvps:${convId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps', filter: `community_group_id=eq.${groupId}` }, ({ new: r, old: o, eventType }) => {
        const rsvp = eventType === 'DELETE' ? o : r
        if (!rsvp?.event_id) return
        setChatEvents(prev => {
          if (!prev[rsvp.event_id]) return prev
          const ev = prev[rsvp.event_id]
          let rsvps
          if (eventType === 'DELETE') {
            rsvps = ev.rsvps.filter(x => x.user_id !== rsvp.user_id)
          } else {
            const existing = ev.rsvps.find(x => x.user_id === rsvp.user_id)
            rsvps = existing
              ? ev.rsvps.map(x => x.user_id === rsvp.user_id ? { ...x, status: rsvp.status } : x)
              : [...ev.rsvps, { user_id: rsvp.user_id, status: rsvp.status, profile: null }]
          }
          return { ...prev, [rsvp.event_id]: { ...ev, rsvps } }
        })
      })
      .subscribe()

    return () => {
      clearTimeout(freshLoadTimerRef.current)
      supabase.removeChannel(msgCh)
      supabase.removeChannel(readCh)
      supabase.removeChannel(convMetaCh)
      supabase.removeChannel(eventRsvpsCh)
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
        const id = unread[0].id
        setFirstUnreadId(id)
        setOpenUnreadCount(unread.length)
        initialFirstUnreadRef.current = id
        unreadDetectedRef.current = true
      }
      // If no unread found in cache, leave unreadDetectedRef false so the
      // fresh-data effect can retry once Supabase data arrives.
    } else {
      unreadDetectedRef.current = true
    }
    setContentReady(true)
  }, [loading, messages])

  // ── Fresh-data unread re-detection ────────────────────────────────────────
  // The initial scroll useEffect runs with cached messages. If the cache
  // predates openedWithLastReadAt, no unread messages are found there and
  // unreadDetectedRef stays false. When the Supabase fetch completes and
  // fetchingFresh becomes false, retry the detection with the fresh messages.
  //
  // We ONLY update state here (for the "New Messages" divider) — we do NOT
  // force a scroll. The ResizeObserver fires before this passive effect and
  // has already scrolled to the latest message. Scrolling here would override
  // that correct position and take the user to an older unread message.
  useEffect(() => {
    if (fetchingFresh) return
    if (!openedWithLastReadAt) return
    if (unreadDetectedRef.current) return
    if (!initialScrollDoneRef.current) return

    unreadDetectedRef.current = true

    const unread = messages.filter(
      m => m.created_at > openedWithLastReadAt && m.user_id !== myId
    )
    if (unread.length === 0) return

    setFirstUnreadId(unread[0].id)
    setOpenUnreadCount(unread.length)
  }, [fetchingFresh, messages, openedWithLastReadAt, myId])

  // Reveal messages after scroll-to-bottom to prevent layout-jump disorientation.
  //
  // Wait for all visible images to decode before revealing so that scrollHeight
  // is accurate when scrollToBottom() fires. The HTML width/height attribute
  // space-reservation hint is not reliable on iOS Safari when style overrides
  // width/height to 'auto', so we can't skip sized images here.
  // An 800ms fallback caps the wait for slow or large images.
  useEffect(() => {
    if (!contentReady) return
    if (!messagesContainerRef.current) { setVisible(true); return }

    const allImgs = Array.from(messagesContainerRef.current.querySelectorAll('img'))

    if (!allImgs.length) { setVisible(true); return }

    let cancelled = false
    const fallback = setTimeout(() => { if (!cancelled) setVisible(true) }, 800)

    Promise.all(allImgs.map(img => img.decode ? img.decode().catch(() => {}) : Promise.resolve()))
      .then(() => { if (!cancelled) { clearTimeout(fallback); setVisible(true) } })

    return () => { cancelled = true; clearTimeout(fallback) }
  }, [contentReady])

  // On reveal: scroll to the first unread message if there are unread messages,
  // otherwise scroll to the bottom. Uses scrollIntoView rather than
  // scrollTop=scrollHeight so the browser computes geometry itself (avoids
  // stale-scrollHeight issues on iOS Safari when the container just became visible).
  useLayoutEffect(() => {
    if (!visible) return

    const targetId = initialFirstUnreadRef.current
    let targetEl = targetId ? document.getElementById(`msg-${targetId}`) : null

    // With virtual rendering the target element may be outside the overscan window.
    // If so, use scrollToIndex to bring it into view first, then re-query the DOM.
    if (targetId && !targetEl && virtualizerRef.current) {
      const idx = itemsRef.current.findIndex(i => i.type === 'msg' && i.msg?.id === targetId)
      if (idx >= 0) {
        virtualizerRef.current.scrollToIndex(idx, { behavior: 'instant', align: 'start' })
        targetEl = document.getElementById(`msg-${targetId}`)
      }
    }

    if (targetEl) {
      // Scroll the first unread message near the top, with a little breathing room
      // so the "New Messages" divider above it is also visible.
      targetEl.scrollIntoView({ block: 'start', behavior: 'instant' })
      if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollTop - 48)
      isAtBottomRef.current = false
      setIsAtBottom(false)
    } else {
      isAtBottomRef.current = true
      setIsAtBottom(true)
      scrollToBottom()
      initialRevealScrollNeeded.current = true
    }

    // After 2 frames the layout is settled. Re-apply the target scroll to correct
    // any stale geometry iOS Safari computed on the first pass.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      initialScrollSettledRef.current = true
      if (!freshLoadRef.current) return
      preserveScrollRef.current = null
      const el = targetId ? document.getElementById(`msg-${targetId}`) : null
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'instant' })
        if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollTop - 48)
      } else {
        isAtBottomRef.current = true
        initialRevealScrollNeeded.current = false
        scrollToBottom()
      }
    }))
  }, [visible])

  // Re-pin to bottom as the message container grows — both on the initial reveal
  // (height:0 → full, where useEffect([visible]) would attach too late) and as
  // realtime messages or images expand the container afterward.
  //
  // Use a direct distance measurement (4px) rather than isAtBottomRef (which is
  // true within AT_BOTTOM_THRESHOLD=20px). The flag-based check was pulling users
  // back while swiping: virtualizer measures new items → ResizeObserver fires →
  // sees isAtBottomRef=true (user was ≤20px from bottom) → scrollToBottom().
  // The 4px threshold only auto-scrolls when the user is essentially at the exact
  // bottom, so a swipe of any meaningful distance is never interrupted.
  useEffect(() => {
    if (!contentReady || !messagesContainerRef.current) return
    const observer = new ResizeObserver(() => {
      if (preserveScrollRef.current) return
      const el = scrollRef.current
      if (!el) return
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight
      if (dist < 4) scrollToBottom()
    })
    observer.observe(messagesContainerRef.current)
    return () => observer.disconnect()
  }, [contentReady])

  // Re-pin to bottom when returning from background if we were at the bottom.
  //
  // iOS WebKit restores inner-div scrollTop asynchronously via the compositor
  // after JS runs, so a single rAF is not enough. We apply the scroll
  // immediately, then watch for a WebKit restoration scroll that overrides it
  // and correct once more. The listener is cleaned up after 1500 ms.
  useEffect(() => {
    function applyBottomScroll() {
      const el = scrollRef.current
      if (!el) return
      scrollToBottom()
      let corrected = false
      let cleanup
      function onRestorationScroll() {
        if (corrected) return
        const dist = el.scrollHeight - el.scrollTop - el.clientHeight
        if (dist > 20) {
          corrected = true
          el.removeEventListener('scroll', onRestorationScroll)
          clearTimeout(cleanup)
          requestAnimationFrame(scrollToBottom)
        }
      }
      el.addEventListener('scroll', onRestorationScroll, { passive: true })
      cleanup = setTimeout(() => el.removeEventListener('scroll', onRestorationScroll), 1500)
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        wasAtBottomRef.current = isAtBottomRef.current
      } else if (document.visibilityState === 'visible' && wasAtBottomRef.current) {
        requestAnimationFrame(applyBottomScroll)
      }
    }

    // pageshow with persisted=true fires when iOS restores the app from a
    // process-kill snapshot — visibilitychange alone doesn't cover this case.
    function onPageShow(e) {
      if (e.persisted && wasAtBottomRef.current) {
        requestAnimationFrame(applyBottomScroll)
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
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
    // forceScroll takes absolute priority: if loadMore() was triggered by a
    // spurious scroll during initial load, cancel its preserveScrollRef and
    // go to the bottom unconditionally.
    const forceScroll = initialRevealScrollNeeded.current
    initialRevealScrollNeeded.current = false
    if (forceScroll) {
      preserveScrollRef.current = null
      isAtBottomRef.current = true
      scrollToBottom()
      return
    }
    if (preserveScrollRef.current) {
      const { scrollTop, scrollHeight } = preserveScrollRef.current
      scrollRef.current.scrollTop = scrollTop + (scrollRef.current.scrollHeight - scrollHeight)
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

  // Auto-focus the newly added poll option input so the keyboard stays up
  useEffect(() => {
    if (justAddedOptionRef.current) {
      justAddedOptionRef.current = false
      pollOptionRefs.current[pollOptions.length - 1]?.focus()
    }
  }, [pollOptions.length])

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
    // Suppress state updates from the programmatic scroll-to-bottom during initial
    // reveal — iOS fires async scroll events with intermediate positions before the
    // scroll settles, which would briefly set isAtBottom=false and flash the button.
    // initialScrollSettledRef is set to true 2 frames after the initial reveal scroll.
    if (!initialScrollSettledRef.current) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < AT_BOTTOM_THRESHOLD
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
    // Gate loadMore on initialScrollSettledRef: the double-rAF in useLayoutEffect([visible])
    // sets this after 2 frames, ensuring iOS Safari has computed the real scrollHeight.
    // Using !initialRevealScrollNeeded was insufficient — any message update (fresh fetch,
    // realtime) would clear that flag before iOS had settled layout, causing loadMore() to
    // fire with scrollTop=0, setting preserveScrollRef, and restoring scroll to the middle.
    if (visible && initialScrollSettledRef.current && el.scrollTop < 60 && hasMore && !loadingMore && !atBottom) loadMore()
  }

  async function loadMore() {
    if (loadingMore || !hasMore || !messages.length) return
    // Capture scroll anchor BEFORE the spinner appears so the saved height
    // doesn't include it. setLoadingMore(false) is batched with setMessages,
    // so the spinner will be absent when useLayoutEffect fires — anchoring
    // against a height that never included it gives the correct delta.
    const anchorScrollTop    = scrollRef.current?.scrollTop    ?? 0
    const anchorScrollHeight = scrollRef.current?.scrollHeight ?? 0
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
      preserveScrollRef.current = { scrollTop: anchorScrollTop, scrollHeight: anchorScrollHeight }
      setMessages(prev => [...older, ...prev])
      fetchPollsForMessages(older)
      fetchEventsForMessages(older)
      fetchPrayerRequestsForMessages(older)
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
    else { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), FOCUS_DELAY_MS) }
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
      }, TYPING_STOP_MS)
    }
    // @mention detection
    const cursor = e.target.selectionStart ?? val.length
    const textBefore = val.slice(0, cursor)
    const match = textBefore.match(/@([\wÀ-ɏ-]*)$/)
    setMentionSearch(match ? match[1] : null)
  }

  function insertMention(member) {
    const el = textareaRef.current
    const cursor = el ? (el.selectionStart ?? text.length) : text.length
    const textBefore = text.slice(0, cursor)
    const mentionStart = textBefore.lastIndexOf('@')
    const firstName = member.display_name.split(' ')[0]
    const mention = `@${firstName}`
    const newText = textBefore.slice(0, mentionStart) + mention + ' ' + text.slice(cursor)
    setText(newText)
    setMentionSearch(null)
    localStorage.setItem(DRAFT_KEY(convId), newText)
    setTimeout(() => {
      if (!el) return
      el.focus()
      const pos = mentionStart + mention.length + 1
      el.setSelectionRange(pos, pos)
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }, 0)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) {
      e.preventDefault()
      handleSend(e)
    }
  }

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend(e) {
    e?.preventDefault()
    if (sendingRef.current) return
    const trimmed = text.trim()
    if (!trimmed && imagePreviews.length === 0) return
    clearTimeout(typingTimeoutRef.current)
    presenceChannelRef.current?.track({ display_name: displayName, typing: false })
    setMentionSearch(null)

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
        _isVideo: preview.isVideo ?? false,
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
      captured.forEach(p => { if (p.isVideo && p.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(p.previewUrl) })
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
      toast('Failed to send message', 'error')
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  function closeLightbox() {
    setLightboxClosing(true)
    setTimeout(() => { if (mountedRef.current) { setLightboxImg(null); setLightboxClosing(false) } }, 250)
  }

  function closeReactionPicker() {
    setReactionPickerClosing(true)
    setTimeout(() => { if (mountedRef.current) { setShowMoreEmojis(false); setReactionPickerClosing(false) } }, 250)
  }

  function closeEmojiPicker() {
    setShowEmojiPicker(false)
  }

  function insertEmoji(emoji) {
    const el = textareaRef.current
    if (!el) return
    const start = savedSelectionRef.current.start
    const end = savedSelectionRef.current.end
    const newText = text.slice(0, start) + emoji + text.slice(end)
    setText(newText)
    closeEmojiPicker()
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
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
    if (last && last.msgId === msgId && now - last.time < DOUBLE_TAP_MS) {
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
    }, LONG_PRESS_MS)
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
    const editedAt = new Date().toISOString()
    const { error } = await supabase.from('messages').update({ body: editText.trim(), edited_at: editedAt }).eq('id', id)
    if (!error) setMessages(prev => prev.map(m => m.id === id ? { ...m, body: editText.trim(), edited_at: editedAt, _edited: true } : m))
    else toast('Failed to edit message', 'error')
  }

  function handleReply(msgId) {
    const msg = messages.find(m => m.id === msgId)
    if (msg) {
      setReplyingTo(msg)
      setTimeout(() => textareaRef.current?.focus(), FOCUS_DELAY_MS)
    }
    closeMenu()
  }

  function scrollToMessage(msgId) {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else {
      // Message is outside the virtualizer's overscan window — scroll by index first
      const idx = items.findIndex(i => i.type === 'msg' && i.msg?.id === msgId)
      if (idx >= 0) virtualizerRef.current?.scrollToIndex(idx, { behavior: 'smooth', align: 'center' })
    }
  }


  async function handleRenameGroup(e) {
    e.preventDefault()
    if (!renameValue.trim()) return
    setRenameSaving(true)
    const { error } = await supabase
      .from('conversations')
      .update({ name: renameValue.trim() })
      .eq('id', convId)
    if (error) {
      toast('Failed to save name', 'error')
    } else {
      setConvName(renameValue.trim())
    }
    setRenameSaving(false)
    setRenamingGroup(false)
  }

  // ── Handlers extracted from JSX for context exposure ─────────────────────
  function handleScrollToBottom() {
    setIsAtBottom(true)
    isAtBottomRef.current = true
    setUnreadCount(0)
    supabase.from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convId).eq('user_id', myId).then(() => {})
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  function onMessageImageLoad() {
    if (isAtBottomRef.current && !preserveScrollRef.current) scrollToBottom()
  }

  function handleImageTap(e, msgId, isOwn, imageUrl) {
    e.stopPropagation()
    const now = Date.now()
    const last = imgTapRef.current
    if (last && last.msgId === msgId && now - last.time < 350) {
      clearTimeout(last.timer)
      imgTapRef.current = null
      if (isOwn) setSelectedMsgId(prev => prev === msgId ? null : msgId)
      else openMenuFromEl(e.currentTarget, msgId, false)
    } else {
      clearTimeout(last?.timer)
      const timer = setTimeout(() => {
        if (!mountedRef.current) return
        imgTapRef.current = null
        setLightboxImg(imageUrl)
      }, 310)
      imgTapRef.current = { msgId, time: now, timer }
    }
  }

  // ── Derived (all memoized so downstream context consumers only re-render
  //    when the values they depend on actually change) ───────────────────────
  const filteredMsgs = useMemo(() =>
    searchQuery.trim()
      ? messages.filter(m =>
          m.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : messages,
    [messages, searchQuery]
  )

  // itemsRef lets useLayoutEffect read the latest items without items in its dep
  // array (which would re-scroll on every new message after initial reveal).
  const itemsRef = useRef([])

  const items = useMemo(() => {
    const result = []
    let lastDate = null
    for (const msg of filteredMsgs) {
      const d = new Date(msg.created_at).toDateString()
      if (d !== lastDate) {
        result.push({ type: 'date', label: dateSeparatorLabel(msg.created_at), key: `date-${msg.created_at}` })
        lastDate = d
      }
      if (firstUnreadId && msg.id === firstUnreadId) {
        result.push({ type: 'unread', key: 'unread-divider' })
      }
      result.push({ type: 'msg', msg })
    }
    // Precompute per-row grouping flags here so the render path doesn't allocate
    // 4 Date objects per visible row per scroll tick (100+ allocs/frame at overscan 25).
    for (let i = 0; i < result.length; i++) {
      const item = result[i]
      if (item.type !== 'msg') continue
      const { msg } = item
      const next = result[i + 1]
      const prev = result[i - 1]
      item.isLastInGroup  = next?.type !== 'msg' || next.msg.user_id !== msg.user_id || new Date(next.msg.created_at) - new Date(msg.created_at) > GROUP_TIME_GAP
      item.isFirstInGroup = prev?.type !== 'msg' || prev.msg.user_id !== msg.user_id || new Date(msg.created_at) - new Date(prev.msg.created_at) > GROUP_TIME_GAP
      item.prevIsImage    = prev?.type === 'msg' && !!prev.msg.image_url
    }
    return result
  }, [filteredMsgs, firstUnreadId])
  itemsRef.current = items

  // O(1) member lookup — declared here so readersAtMessage can reference it
  // without a forward const reference (TDZ) in its deps array.
  const memberMap = useMemo(() =>
    Object.fromEntries(members.map(m => [m.user_id, m])),
    [members]
  )

  const senderName = useCallback(
    (userId, storedName) => memberMap[userId]?.display_name || storedName,
    [memberMap]
  )

  const readersAtMessage = useMemo(() => {
    const map = {}
    for (const [userId, lastReadAt] of Object.entries(memberReadTimes)) {
      if (!lastReadAt) continue
      const readTime = new Date(lastReadAt)
      // Binary-search the ascending-sorted filteredMsgs for the rightmost message
      // with created_at <= readTime (O(log n) vs the previous O(n) reverse scan).
      let lo = 0, hi = filteredMsgs.length - 1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        new Date(filteredMsgs[mid].created_at) <= readTime ? (lo = mid + 1) : (hi = mid - 1)
      }
      // hi is now the rightmost index ≤ readTime; scan back past any temp messages.
      let lastReadMsgId = null
      for (let i = hi; i >= 0; i--) {
        if (!filteredMsgs[i]._tempId) { lastReadMsgId = filteredMsgs[i].id; break }
      }
      if (lastReadMsgId) {
        if (!map[lastReadMsgId]) map[lastReadMsgId] = []
        const member = memberMap[userId]
        if (member) map[lastReadMsgId].push(member)
      }
    }
    return map
  }, [memberReadTimes, filteredMsgs, memberMap])

  const typing = useMemo(() => typingLabel(typingUsers), [typingUsers])

  const typingEverShownRef = useRef(false)
  useEffect(() => {
    if (typing) {
      typingEverShownRef.current = true
      clearTimeout(typingCloseRef.current)
      setTypingClosing(false)
    } else if (typingEverShownRef.current) {
      // Only play the closing animation if the indicator was actually shown;
      // skips the spurious 250ms flash on initial mount when typing = ''.
      setTypingClosing(true)
      typingCloseRef.current = setTimeout(() => { if (mountedRef.current) setTypingClosing(false) }, 250)
    }
    return () => clearTimeout(typingCloseRef.current)
  }, [typing])

  const title = useMemo(() => {
    if (conversation.type === 'direct') {
      const otherId = conversation.conversation_members?.find(m => m.user_id !== myId)?.user_id
      return members.find(m => m.user_id === otherId)?.display_name || 'Direct Message'
    }
    if (convName) return convName
    const otherIds = conversation.conversation_members
      ?.filter(m => m.user_id !== myId)?.map(m => m.user_id) ?? []
    const names = otherIds
      .map(id => members.find(m => m.user_id === id)?.display_name?.split(' ')[0])
      .filter(Boolean)
    if (!names.length) return 'Group Chat'
    if (names.length <= 3) return names.join(', ')
    return `${names.slice(0, 3).join(', ')} +${names.length - 3}`
  }, [conversation, members, myId, convName])

  const activeMessage  = useMemo(() => messages.find(m => m.id === activeMsg), [messages, activeMsg])
  const dmOtherMember  = useMemo(() => {
    if (conversation.type !== 'direct') return null
    const otherId = conversation.conversation_members?.find(m => m.user_id !== myId)?.user_id
    return otherId ? members.find(m => m.user_id === otherId) ?? null : null
  }, [conversation, members, myId])
  const isMainGroupChat = useMemo(() =>
    conversation.type === 'group' && (conversation.conversation_members?.length ?? 0) >= members.length,
    [conversation, members]
  )
  const canEditGroupInfo = useMemo(() =>
    conversation.type === 'group' && (isMainGroupChat ? isAdmin : true),
    [conversation, isMainGroupChat, isAdmin]
  )

  // ── Render ────────────────────────────────────────────────────────────────
  // Data context: consumed by MessageList and ConversationInfo.
  // Does NOT include text/imagePreviews/mentionSearch so keystrokes don't
  // re-render MessageList on every character typed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctxValue = useMemo(() => ({
    // Refs (stable)
    scrollRef, messagesContainerRef, textareaRef, fileInputRef, editTextareaRef,
    presenceChannelRef, typingTimeoutRef, savedSelectionRef,
    pollOptionRefs, justAddedOptionRef, pollQuestionRef, groupIconFileRef,
    inputWrapperRef, virtualizerRef,
    // Props
    conversation, session, myId, convId, displayName, groupId,
    members, isAdmin,
    // Derived
    filteredMsgs, items, readersAtMessage, typing, title, activeMessage,
    dmOtherMember, isMainGroupChat, canEditGroupInfo, memberMap,
    senderName,
    // State (message/UI, not compose state)
    messages, loading, visible, contentReady, fetchingFresh, hasMore, loadingMore,
    searchOpen, setSearchOpen, searchQuery, setSearchQuery,
    isAtBottom, setIsAtBottom,
    typingUsers, reactions, justReacted,
    activeMsg, setActiveMsg, menuPos, menuClosing, closeMenu,
    showMoreEmojis, setShowMoreEmojis,
    reactionPickerClosing, setReactionPickerClosing,
    notesOpen, setNotesOpen,
    setReplyingTo,
    infoOpen, setInfoOpen, infoClosing, closeInfo,
    renamingGroup, setRenamingGroup,
    confirmDeleteMsg, setConfirmDeleteMsg,
    editingMsgId, editText, setEditText, editClosingId,
    selectedMsgId, setSelectedMsgId,
    confirmDeleteId, setConfirmDeleteId,
    convName, renameValue, setRenameValue, renameSaving,
    memberReadTimes, unreadCount, setUnreadCount,
    firstUnreadId, setFirstUnreadId, openUnreadCount,
    lightboxImg, setLightboxImg,
    convImageUrl, uploadingGroupIcon,
    polls, chatEvents, chatPrayers,
    pollMenuOpenId, setPollMenuOpenId,
    deletingPollId,
    editingPollId, setEditingPollId,
    editPollQuestion, setEditPollQuestion,
    editPollOptions, setEditPollOptions,
    savingPoll,
    // Handlers used by MessageList / ConversationInfo
    scrollToBottom, handleScroll, loadMore, toggleSearch,
    toggleReaction, deleteMessage, openMenuFromEl, exitEdit, openMenu,
    handleDoubleTap, handleLongPressStart, handleLongPressEnd,
    startEdit, handleSaveEdit, handleReply, closeReactionPicker,
    uploadGroupIcon, removeGroupIcon,
    castVote, rsvpInChat, prayInChat, startEditPoll, savePoll, deletePoll,
    handleRenameGroup, scrollToMessage, formatEventDate,
    handleScrollToBottom, onMessageImageLoad, handleImageTap,
    retryMessage,
    headerH, inputH,
  }), [
    conversation, session, myId, convId, displayName, groupId, members, isAdmin,
    filteredMsgs, items, readersAtMessage, typing, title, activeMessage,
    dmOtherMember, isMainGroupChat, canEditGroupInfo, memberMap,
    messages, loading, visible, contentReady, fetchingFresh, hasMore, loadingMore,
    searchOpen, searchQuery, isAtBottom, typingUsers,
    reactions, justReacted, activeMsg, menuPos, menuClosing, showMoreEmojis,
    reactionPickerClosing, notesOpen,
    infoOpen, infoClosing, renamingGroup, renameValue, renameSaving, confirmDeleteMsg,
    editingMsgId, editText, editClosingId, selectedMsgId, confirmDeleteId,
    convName, memberReadTimes, unreadCount, firstUnreadId, openUnreadCount,
    lightboxImg, convImageUrl, uploadingGroupIcon, polls, chatEvents,
    pollMenuOpenId,
    deletingPollId, editingPollId, editPollQuestion, editPollOptions, savingPoll, chatPrayers,
    headerH, inputH,
  ])

  // Input context: consumed only by MessageInput.
  // Recreated on every keystroke but MessageList never sees it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inputCtxValue = useMemo(() => ({
    // Compose state
    text, setText, imagePreviews, setImagePreviews,
    replyingTo, setReplyingTo,
    sending,
    mentionSearch, setMentionSearch, insertMention,
    showEmojiPicker, setShowEmojiPicker,
    pollCreating, setPollCreating,
    pollQuestion, setPollQuestion,
    pollOptions, setPollOptions,
    pollSubmitting,
    // Shared refs MessageInput needs
    textareaRef, fileInputRef, savedSelectionRef, scrollRef,
    presenceChannelRef, typingTimeoutRef,
    pollOptionRefs, justAddedOptionRef, pollQuestionRef,
    // Props
    members, myId, displayName, convId,
    senderName,
    // Handlers that read current text/imagePreviews via closure
    handleTextInput, handleKeyDown, handleSend, handleFileChange, removePreview,
    closeEmojiPicker, insertEmoji, createPoll,
  }), [
    text, imagePreviews, replyingTo, sending,
    mentionSearch, showEmojiPicker,
    pollCreating, pollQuestion, pollOptions, pollSubmitting,
    members, myId, displayName, convId, memberMap,
  ])

  return (
    <ChatContext.Provider value={ctxValue}>
    <ChatInputContext.Provider value={inputCtxValue}>
    {/* Fixed frosted overlay for the iOS status bar zone — same styling as the header, ensures visual continuity */}
    <div
      className="fixed top-0 left-0 right-0 lg:left-56 pointer-events-none z-[11] bg-sunrise-50/85 backdrop-blur-md"
      style={{ height: 'env(safe-area-inset-top)' }}
    />
    <div
      className={`chat-container relative flex flex-col bg-sunrise-50 ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
    >
      {/* Header — container starts at y:0 (safe-area included), so top:0 + padding reaches screen top */}
      <div
        className="absolute top-0 left-0 right-0 z-10 bg-sunrise-50/85 backdrop-blur-md"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
      {/* Inner wrapper — measured by ResizeObserver; height = visible portion in chat-container */}
      <div ref={headerWrapperRef}>
      {/* Header */}
      <div className="max-w-3xl mx-auto w-full px-3 pt-6 pb-3 flex items-center gap-2">
        <button
          onClick={onBack}
          className="relative w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={20} weight="bold" />
          {otherUnreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none pointer-events-none">
              {otherUnreadCount > 9 ? '9+' : otherUnreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setInfoOpen(true)}
          className="flex-1 min-w-0 flex items-center gap-2.5 text-left active:opacity-75 transition-opacity"
        >
          <div className={`w-9 h-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center ${
            conversation.type === 'group'
              ? convImageUrl ? 'bg-stone-200' : 'bg-ember'
              : dmOtherMember?.avatar_image_url ? 'bg-stone-200 shadow-sm' : avatarColor(dmOtherMember?.user_id ?? '', dmOtherMember?.avatar_color)
          }`}>
            {conversation.type === 'group'
              ? convImageUrl
                ? <img src={convImageUrl} alt="" className="w-full h-full object-cover" />
                : <Users size={18} weight="fill" className="text-white" />
              : dmOtherMember?.avatar_image_url
                ? <img src={dmOtherMember.avatar_image_url} alt="" className="w-full h-full object-cover" />
                : dmOtherMember?.avatar_icon
                  ? <AvatarIcon name={dmOtherMember.avatar_icon} size={18} />
                  : <span className="text-white text-sm font-bold">{initials(title)}</span>
            }
          </div>
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
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${searchOpen ? 'bg-ember text-white' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
        >
          <MagnifyingGlass size={20} weight={searchOpen ? 'fill' : 'regular'} />
        </button>
      </div>

      {/* Search bar */}
      <motion.div
        initial={false}
        animate={{
          height: searchOpen ? 'auto' : 0,
          opacity: searchOpen ? 1 : 0,
        }}
        transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
        style={{ overflow: 'hidden', padding: '2px', margin: '-2px' }}
        className="shrink-0"
      >
        <div className="max-w-3xl mx-auto w-full px-4 pb-2">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-9 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-stone-500 mt-1.5 px-1">
              {filteredMsgs.length} {filteredMsgs.length === 1 ? 'message' : 'messages'} found
            </p>
          )}
        </div>
      </motion.div>

      </div>{/* end inner measured wrapper */}
      </div>{/* end header outer (safe-area extension) */}

      {/* Unread pill — fixed so it stays in viewport coords regardless of parent scroll */}
      {(firstUnreadId || pillClosing) && !searchOpen && (
        <div className={`fixed left-0 right-0 lg:left-56 flex justify-center py-1.5 z-[9] ${pillClosing ? 'animate-overlay-out' : 'animate-overlay-in'}`} style={{ top: `calc(env(safe-area-inset-top) + ${headerH}px)` }}>
          <button
            onClick={() => {
              document.getElementById(`msg-${firstUnreadId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              setPillClosing(true)
              setTimeout(() => { setFirstUnreadId(null); setPillClosing(false) }, 220)
            }}
            className="flex items-center gap-1.5 bg-ember text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md"
          >
            <ArrowUp size={12} weight="bold" />
            {openUnreadCount} new message{openUnreadCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Messages */}
      <MessageList />

      {/* Floating input overlay — sits above the message list */}
      <div
        ref={inputWrapperRef}
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
      >
        <div className="pointer-events-auto" style={{ paddingBottom: keyboardOpen ? '0' : 'var(--sab)' }}>
          {(typing || typingClosing) && (
            <div className={`px-4 pb-1 max-w-3xl mx-auto w-full ${typingClosing ? 'animate-overlay-out' : 'animate-overlay-in'}`}>
              <span className="text-xs text-stone-500 ml-1 block mb-1">{typing}</span>
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
          <MessageInput />
        </div>
      </div>

      {/* Action menu */}
      {activeMsg && menuPos && (
        <>
        <div className="fixed inset-0 z-[29] select-none" onTouchStart={e => { e.preventDefault(); if (!confirmDeleteMsg) closeMenu() }} onClick={() => { if (!confirmDeleteMsg) closeMenu() }} />
        <div
          className="fixed z-30"
          style={{ bottom: menuPos.bottom, ...('right' in menuPos ? { right: menuPos.right } : { left: '50%', transform: 'translateX(-50%)' }) }}
        >
        <div className={`bg-white rounded-2xl shadow-xl border border-stone-100 p-1.5 ${menuClosing ? 'animate-popup-out' : 'animate-popup-in'}`}>
          {/* Emoji row — always fits; actions on a separate row so neither wraps */}
          <div className="flex items-center justify-center gap-0.5">
            {EMOJIS.map(emoji => {
              const reacted = reactions[activeMsg]?.[emoji]?.some(r => r.user_id === myId)
              return (
                <button
                  key={emoji}
                  onClick={() => toggleReaction(activeMsg, emoji)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${reacted ? 'bg-ember/10' : 'hover:bg-stone-100'}`}
                >
                  {emoji}
                </button>
              )
            })}
            <button
              onClick={() => showMoreEmojis ? closeReactionPicker() : setShowMoreEmojis(true)}
              aria-label={showMoreEmojis ? 'Close emoji picker' : 'More emojis'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${showMoreEmojis ? 'bg-ember text-white' : 'text-stone-400 hover:bg-stone-100'}`}
            >
              {showMoreEmojis ? '×' : '+'}
            </button>
          </div>
          {/* Actions row */}
          <div className="flex items-center justify-center gap-0.5 pt-0.5 mt-0.5 border-t border-stone-100">
            {activeMessage?.body && (
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(activeMessage.body)
                  closeMenu()
                  toast('Copied', 'success')
                }}
                aria-label="Copy message"
                className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
              >
                <Copy size={14} weight="bold" />
              </button>
            )}
            <button
              onClick={() => handleReply(activeMsg)}
              aria-label="Reply"
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
                    aria-label="Edit message"
                    className="w-9 h-9 rounded-xl hover:bg-stone-100 flex items-center justify-center text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    <PencilSimple size={14} weight="bold" />
                  </button>
                )}
                <button
                  onClick={() => setConfirmDeleteMsg(true)}
                  aria-label="Delete message"
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
          <div className={`fixed inset-x-0 lg:left-56 bottom-0 z-40 bg-white border-t border-stone-100 shadow-xl ${reactionPickerClosing ? 'animate-sheet-out' : 'animate-modal-in'}`} style={{ paddingBottom: 'var(--sab)', overscrollBehavior: 'contain' }}>
            <Suspense fallback={null}>
              <EmojiPicker
                onEmojiClick={emojiData => toggleReaction(activeMsg, emojiData.emoji)}
                width="calc(100% - 2px)"
                height={350}
                searchPlaceholder="Search emojis…"
                previewConfig={{ showPreview: false }}
                autoFocusSearch={false}
                defaultSkinTone={localStorage.getItem('emoji-skin-tone') || 'neutral'}
                onSkinToneChange={tone => localStorage.setItem('emoji-skin-tone', tone)}
              />
            </Suspense>
          </div>
        </>
      )}

      {activeMsg && (
        <div className="fixed inset-0 z-20" onClick={closeMenu} />
      )}

      <ConversationInfo />

      {notesOpen && <NotesModal groupId={groupId} onClose={() => setNotesOpen(false)} />}

      {/* Image / video lightbox */}
      {(lightboxImg || lightboxClosing) && (
        <div
          className={`fixed inset-0 z-50 bg-black/90 flex items-center justify-center ${lightboxClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`}
          onClick={closeLightbox}
          onTouchStart={e => { lightboxTouchStartY.current = e.touches[0].clientY }}
          onTouchEnd={e => {
            const dy = e.changedTouches[0].clientY - (lightboxTouchStartY.current ?? 0)
            if (dy > 80) closeLightbox()
            lightboxTouchStartY.current = null
          }}
        >
          {isVideoUrl(lightboxImg) ? (
            <video
              src={lightboxImg}
              controls
              autoPlay
              playsInline
              className={`max-w-full max-h-full rounded-lg ${lightboxClosing ? 'animate-lightbox-img-out' : 'animate-lightbox-img-in'}`}
              style={{ maxHeight: 'calc(100svh - 80px)', maxWidth: 'calc(100vw - 32px)' }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <img
              src={lightboxImg}
              alt="Full size"
              className={`max-w-full max-h-full object-contain rounded-lg ${lightboxClosing ? 'animate-lightbox-img-out' : 'animate-lightbox-img-in'}`}
              style={{ maxHeight: 'calc(100svh - 80px)', maxWidth: 'calc(100vw - 32px)' }}
              onClick={closeLightbox}
            />
          )}
          <button
            onClick={e => { e.stopPropagation(); closeLightbox() }}
            className="absolute right-4 z-10 w-10 h-10 bg-black/40 text-white rounded-full flex items-center justify-center hover:bg-black/60 transition-colors"
            style={{ top: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          >
            <X size={20} weight="bold" />
          </button>
        </div>
      )}
    </div>
    </ChatInputContext.Provider>
    </ChatContext.Provider>
  )
}
