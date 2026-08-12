import { useState, useEffect, useRef, useLayoutEffect, useMemo, lazy, Suspense } from 'react'
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
import { initials } from '../utils/format.js'
import { haptic } from '../lib/haptic.js'
import { trackEvent } from '../lib/analytics.js'
import { ChatContext } from './chat/ChatContext.jsx'
import MessageList from './chat/MessageList.jsx'
import MessageInput from './chat/MessageInput.jsx'
import ConversationInfo from './chat/ConversationInfo.jsx'

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
  const [justReacted, setJustReacted]   = useState({})
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
  const [convImageUrl, setConvImageUrl]       = useState(conversation.image_url ?? null)
  const [uploadingGroupIcon, setUploadingGroupIcon] = useState(false)
  const [polls, setPolls]                     = useState({})
  const [chatEvents, setChatEvents]           = useState({})
  const [chatPrayers, setChatPrayers]         = useState({})
  const [pollCreating, setPollCreating]       = useState(false)
  const [pollQuestion, setPollQuestion]       = useState('')
  const [pollOptions, setPollOptions]         = useState(['', ''])
  const [pollSubmitting, setPollSubmitting]   = useState(false)
  const [pollMenuOpenId, setPollMenuOpenId]   = useState(null)
  const [deletingPollId, setDeletingPollId]   = useState(null)
  const [editingPollId, setEditingPollId]     = useState(null)
  const [editPollQuestion, setEditPollQuestion] = useState('')
  const [editPollOptions, setEditPollOptions]   = useState([])
  const [savingPoll, setSavingPoll]           = useState(false)

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

  const freshLoadRef               = useRef(false)
  const freshLoadTimerRef          = useRef(null)
  const mountedRef                 = useRef(true)
  const wasAtBottomRef             = useRef(true)
  const initialRevealScrollNeeded  = useRef(false)
  const initialScrollSettledRef    = useRef(false)
  const initialFirstUnreadRef      = useRef(null)
  const unreadDetectedRef          = useRef(false)
  const messagesContainerRef  = useRef(null)
  const sendingRef            = useRef(false)
  const pollOptionRefs        = useRef([])
  const justAddedOptionRef    = useRef(false)
  const pollQuestionRef       = useRef(null)
  const savedSelectionRef     = useRef({ start: 0, end: 0 })
  const groupIconFileRef      = useRef(null)
  const headerWrapperRef      = useRef(null)
  const [headerH, setHeaderH] = useState(80)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const el = headerWrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setHeaderH(entry.contentRect.height))
    ro.observe(el)
    return () => ro.disconnect()
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
    const baseline = Math.round(vv.height)
    let kbOpen = false

    function update() {
      const nowVVH = Math.round(vv.height)
      const kbH = baseline - nowVVH
      const nowOpen = kbH > 120
      // sat + vv.offsetTop + vv.height:
      //   vv.height      = visible area from the visual-viewport top to keyboard top
      //   vv.offsetTop   = visual viewport's offset within the layout viewport
      //   sat            = status-bar height; document y=0 is behind the status bar,
      //                    so the keyboard top in document coordinates is sat higher
      //                    than vv.offsetTop + vv.height alone.
      document.documentElement.style.setProperty(
        '--vvh',
        `${Math.round(sat + vv.offsetTop + vv.height)}px`
      )
      if (nowOpen && !kbOpen) {
        kbOpen = true
        document.body.classList.add('chat-keyboard-open')
      } else if (!nowOpen && kbOpen) {
        kbOpen = false
        document.body.classList.remove('chat-keyboard-open')
        window.scrollTo(0, 0)
      }
    }

    vv.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      document.body.classList.remove('chat-keyboard-open')
      document.documentElement.style.removeProperty('--vvh')
    }
  }, [])

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

  // ── Poll helpers ─────────────────────────────────────────────────────────
  async function fetchPollsForMessages(msgs) {
    const ids = [...new Set(msgs.filter(m => m.poll_id).map(m => m.poll_id))]
    if (!ids.length) return
    const [{ data: ps }, { data: vs }] = await Promise.all([
      supabase.from('polls').select('id, question, options').in('id', ids),
      supabase.from('poll_votes').select('poll_id, user_id, option_index').in('poll_id', ids),
    ])
    const map = {}
    for (const p of ps ?? []) map[p.id] = { question: p.question, options: p.options, votes: [] }
    for (const v of vs ?? []) { if (map[v.poll_id]) map[v.poll_id].votes.push(v) }
    if (Object.keys(map).length) {
      setPolls(prev => ({ ...prev, ...map }))
      if (freshLoadRef.current) requestAnimationFrame(() => requestAnimationFrame(() => { if (isAtBottomRef.current) scrollToBottom() }))
    }
  }

  async function fetchEventsForMessages(msgs) {
    const ids = [...new Set(msgs.filter(m => m.event_id).map(m => m.event_id))]
    if (!ids.length) return
    const [{ data: evs }, { data: rs }] = await Promise.all([
      supabase.from('events').select('id, title, event_date, event_time, location').in('id', ids),
      supabase.from('event_rsvps')
        .select('event_id, user_id, status, profiles(display_name, avatar_icon, avatar_color, avatar_image_url)')
        .in('event_id', ids),
    ])
    const map = {}
    for (const e of evs ?? []) map[e.id] = { ...e, rsvps: [] }
    for (const r of rs ?? []) {
      if (map[r.event_id]) map[r.event_id].rsvps.push({ user_id: r.user_id, status: r.status, profile: r.profiles })
    }
    if (Object.keys(map).length) {
      setChatEvents(prev => ({ ...prev, ...map }))
      if (freshLoadRef.current) requestAnimationFrame(() => requestAnimationFrame(() => { if (isAtBottomRef.current) scrollToBottom() }))
    }
  }

  async function fetchPrayerRequestsForMessages(msgs) {
    const ids = [...new Set(msgs.filter(m => m.prayer_request_id).map(m => m.prayer_request_id))]
    if (!ids.length) return
    const [{ data: prs }, { data: rxs }] = await Promise.all([
      supabase.from('prayer_requests').select('id, request, member_user_id').in('id', ids),
      supabase.from('prayer_reactions').select('prayer_request_id, user_id, display_name, avatar_icon, avatar_color').in('prayer_request_id', ids),
    ])
    if (!prs?.length) return
    const memberUserIds = [...new Set(prs.map(pr => pr.member_user_id))]
    const { data: memberProfiles } = await supabase.from('profiles').select('user_id, display_name, avatar_icon, avatar_color, avatar_image_url').in('user_id', memberUserIds)
    const profileMap = {}
    for (const p of memberProfiles ?? []) profileMap[p.user_id] = p
    const map = {}
    for (const pr of prs) map[pr.id] = { id: pr.id, request: pr.request, member_user_id: pr.member_user_id, member: profileMap[pr.member_user_id] ?? null, reactions: [] }
    for (const rx of rxs ?? []) { if (map[rx.prayer_request_id]) map[rx.prayer_request_id].reactions.push(rx) }
    if (Object.keys(map).length) {
      setChatPrayers(prev => ({ ...prev, ...map }))
      if (freshLoadRef.current) requestAnimationFrame(() => requestAnimationFrame(() => { if (isAtBottomRef.current) scrollToBottom() }))
    }
  }

  async function prayInChat(prayerReqId) {
    const pr = chatPrayers[prayerReqId]
    if (!pr) return
    const hasReacted = pr.reactions.some(rx => rx.user_id === myId)
    const myMember = members.find(m => m.user_id === myId)
    setChatPrayers(prev => {
      const p = prev[prayerReqId]
      if (!p) return prev
      const reactions = hasReacted
        ? p.reactions.filter(rx => rx.user_id !== myId)
        : [...p.reactions, { user_id: myId, display_name: displayName, avatar_icon: myMember?.avatar_icon ?? null, avatar_color: myMember?.avatar_color ?? null }]
      return { ...prev, [prayerReqId]: { ...p, reactions } }
    })
    if (hasReacted) {
      await supabase.from('prayer_reactions').delete().eq('prayer_request_id', prayerReqId).eq('user_id', myId)
    } else {
      await supabase.from('prayer_reactions').insert({
        prayer_request_id: prayerReqId,
        prayer_request_owner_id: pr.member_user_id,
        community_group_id: groupId,
        user_id: myId,
        display_name: displayName,
        avatar_icon: myMember?.avatar_icon ?? null,
        avatar_color: myMember?.avatar_color ?? null,
      })
    }
  }

  async function rsvpInChat(eventId, status) {
    const ev = chatEvents[eventId]
    if (!ev) return
    const myRsvp = ev.rsvps.find(r => r.user_id === myId)
    const isToggle = myRsvp?.status === status
    const myMember = members.find(m => m.user_id === myId)
    setChatEvents(prev => {
      const e = prev[eventId]
      if (!e) return prev
      const filtered = e.rsvps.filter(r => r.user_id !== myId)
      const rsvps = isToggle ? filtered : [...filtered, { user_id: myId, status, profile: myMember ?? { display_name: displayName } }]
      return { ...prev, [eventId]: { ...e, rsvps } }
    })
    if (isToggle) {
      await supabase.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', myId)
    } else {
      await supabase.from('event_rsvps').upsert({ event_id: eventId, user_id: myId, status }, { onConflict: 'event_id,user_id' })
    }
  }

  async function createPoll() {
    const question = pollQuestion.trim()
    const opts = pollOptions.map(o => o.trim()).filter(Boolean)
    if (!question || opts.length < 2 || pollSubmitting) return
    setPollSubmitting(true)
    try {
      const { data: poll, error: pollErr } = await supabase.from('polls').insert({
        community_group_id: groupId,
        conversation_id: convId,
        question,
        options: opts.map(text => ({ text })),
        created_by: myId,
      }).select('id').single()
      if (pollErr || !poll) throw pollErr ?? new Error('poll insert failed')

      const replyId = replyingTo?.id ?? null
      const { data: newMsg, error: msgErr } = await supabase.from('messages').insert({
        community_group_id: groupId,
        conversation_id: convId,
        user_id: myId,
        display_name: displayName || 'Member',
        body: `📊 Poll: ${question}`,
        poll_id: poll.id,
        reply_to_id: replyId,
      }).select('*, reply_message:reply_to_id(id, body, display_name, image_url)').single()
      if (msgErr) throw msgErr

      // Build poll data object once — used for both state AND embedded in the message
      const pollData = { question, options: opts.map(text => ({ text })), votes: [] }

      // Update polls + messages in the same synchronous block so they land in one React render.
      // Also embed _poll on the message itself as a fallback in case the polls state update
      // races with the realtime INSERT handler.
      setPolls(prev => ({ ...prev, [poll.id]: pollData }))
      if (newMsg) {
        isAtBottomRef.current = true
        setIsAtBottom(true)
        setMessages(prev =>
          prev.some(m => m.id === newMsg.id)
            ? prev
            : [...prev, { ...newMsg, poll_id: poll.id, _poll: pollData, _isNew: true }]
        )
      }

      setPollCreating(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      setReplyingTo(null)
    } catch (e) {
      console.error('createPoll error:', e)
    } finally {
      setPollSubmitting(false)
    }
  }

  async function castVote(pollId, optionIndex) {
    setPolls(prev => {
      if (!prev[pollId]) return prev
      const p = prev[pollId]
      return { ...prev, [pollId]: { ...p, votes: [...p.votes.filter(v => v.user_id !== myId), { poll_id: pollId, user_id: myId, option_index: optionIndex }] } }
    })
    const { error } = await supabase.from('poll_votes').upsert({ poll_id: pollId, user_id: myId, option_index: optionIndex })
    if (error) console.error('castVote error:', error)
  }

  function startEditPoll(pollId, poll) {
    if (!poll) return
    setEditPollQuestion(poll.question)
    setEditPollOptions(poll.options.map(o => o.text))
    setEditingPollId(pollId)
    setPollMenuOpenId(null)
  }

  async function savePoll(pollId) {
    const question = editPollQuestion.trim()
    const opts = editPollOptions.map(o => o.trim()).filter(Boolean)
    if (!question || opts.length < 2 || savingPoll) return
    setSavingPoll(true)
    try {
      const { error } = await supabase.from('polls')
        .update({ question, options: opts.map(text => ({ text })) })
        .eq('id', pollId)
      if (error) throw error
      await supabase.from('poll_votes').delete().eq('poll_id', pollId)
      setPolls(prev => ({
        ...prev,
        [pollId]: { ...prev[pollId], question, options: opts.map(text => ({ text })), votes: [] },
      }))
      setEditingPollId(null)
    } catch (e) {
      console.error('savePoll error:', e)
    } finally {
      setSavingPoll(false)
    }
  }

  async function deletePoll(pollId, messageId) {
    setPollMenuOpenId(null)
    setDeletingPollId(pollId)
    await new Promise(r => setTimeout(r, 260))
    setMessages(prev => prev.filter(m => m.id !== messageId))
    setPolls(prev => { const next = { ...prev }; delete next[pollId]; return next })
    setDeletingPollId(null)
    await supabase.from('messages').delete().eq('id', messageId)
    await supabase.from('polls').delete().eq('id', pollId)
  }

  // ── Messages + reactions + realtime ──────────────────────────────────────
  useEffect(() => {
    onRead?.()
    setMessages([])
    setPolls({})
    setChatEvents({})
    setReplyingTo(null)
    setMemberReadTimes({})
    setUnreadCount(0)
    setContentReady(false)
    setVisible(false)
    setFetchingFresh(false)
    setFirstUnreadId(null)
    setOpenUnreadCount(0)
    setConvName(conversation.name)
    initialScrollDoneRef.current = false
    pendingScrollRef.current = null
    initialScrollSettledRef.current = false
    initialFirstUnreadRef.current = null
    unreadDetectedRef.current = false
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
            scrollToBottom()
            const el = scrollRef.current
            if (!el) return
            let cleanup
            function onRestorationScroll() {
              const dist = el.scrollHeight - el.scrollTop - el.clientHeight
              if (dist > 20) {
                el.removeEventListener('scroll', onRestorationScroll)
                clearTimeout(cleanup)
                requestAnimationFrame(() => { if (mountedRef.current) scrollToBottom() })
              }
            }
            el.addEventListener('scroll', onRestorationScroll, { passive: true })
            cleanup = setTimeout(() => el.removeEventListener('scroll', onRestorationScroll), 1500)
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
        filter: `community_group_id=eq.${groupId}`,
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

    const pollVotesCh = supabase
      .channel(`poll-votes:${convId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes' }, ({ new: v, old: o, eventType }) => {
        const vote = eventType === 'DELETE' ? o : v
        if (!vote?.poll_id) return
        setPolls(prev => {
          if (!prev[vote.poll_id]) return prev
          const p = prev[vote.poll_id]
          let votes
          if (eventType === 'DELETE') {
            votes = p.votes.filter(x => !(x.poll_id === vote.poll_id && x.user_id === vote.user_id))
          } else {
            votes = [...p.votes.filter(x => x.user_id !== vote.user_id), vote]
          }
          return { ...prev, [vote.poll_id]: { ...p, votes } }
        })
      })
      .subscribe()

    const eventRsvpsCh = supabase
      .channel(`event-rsvps:${convId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_rsvps' }, ({ new: r, old: o, eventType }) => {
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
      supabase.removeChannel(rxCh)
      supabase.removeChannel(readCh)
      supabase.removeChannel(convMetaCh)
      supabase.removeChannel(pollVotesCh)
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
    const targetEl = targetId ? document.getElementById(`msg-${targetId}`) : null

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
  useEffect(() => {
    if (!contentReady || !messagesContainerRef.current) return
    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current && !preserveScrollRef.current) scrollToBottom()
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
    // Gate loadMore on initialScrollSettledRef: the double-rAF in useLayoutEffect([visible])
    // sets this after 2 frames, ensuring iOS Safari has computed the real scrollHeight.
    // Using !initialRevealScrollNeeded was insufficient — any message update (fresh fetch,
    // realtime) would clear that flag before iOS had settled layout, causing loadMore() to
    // fire with scrollTop=0, setting preserveScrollRef, and restoring scroll to the middle.
    if (visible && initialScrollSettledRef.current && el.scrollTop < 60 && hasMore && !loadingMore && !atBottom) loadMore()
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
      fetchPollsForMessages(older)
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

  // Returns { file, width, height } — dimensions are the final stored pixel size.
  function compressImage(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      return new Promise(resolve => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload  = () => { URL.revokeObjectURL(url); resolve({ file, width: img.naturalWidth, height: img.naturalHeight }) }
        img.onerror = () => { URL.revokeObjectURL(url); resolve({ file, width: null, height: null }) }
        img.src = url
      })
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)

        function tryEncode(maxDim, quality) {
          const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
          const w = Math.round(img.naturalWidth * scale)
          const h = Math.round(img.naturalHeight * scale)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          canvas.toBlob(blob => {
            if (blob) {
              resolve({ file: new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }), width: w, height: h })
            } else if (maxDim > 600) {
              // toBlob returned null (memory pressure); retry at half the dimension
              tryEncode(Math.round(maxDim / 2), quality)
            } else {
              // Exhausted retries — reject so the caller can surface an error
              reject(new Error('Image compression failed'))
            }
          }, 'image/jpeg', quality)
        }

        tryEncode(1200, 0.82)
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
      img.src = url
    })
  }


  async function uploadGroupIcon(file) {
    if (!file || uploadingGroupIcon) return
    setUploadingGroupIcon(true)
    try {
      // Compress if possible; fall back to original if compression fails (e.g. null toBlob on iOS)
      let compressed = file
      try {
        const result = await compressImage(file)
        compressed = result.file
      } catch {}
      // Always use a fresh timestamped path — the chat-images bucket has no UPDATE policy,
      // so upsert on an existing path is blocked by RLS. A new path is always an INSERT.
      // Prefix with myId so the owner-delete RLS policy allows cleanup later.
      const ext = compressed.name?.split('.').pop() || 'jpg'
      const path = `${myId}/group-icons/${convId}-${Date.now()}.${ext}`
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('chat-images')
        .upload(path, compressed, { contentType: compressed.type || 'image/jpeg' })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(uploaded.path)
      const { error } = await supabase.from('conversations').update({ image_url: publicUrl }).eq('id', convId)
      if (error) throw error
      setConvImageUrl(publicUrl)
    } catch (err) {
      console.error('uploadGroupIcon failed:', err)
      toast('Failed to upload icon', 'error')
    } finally {
      setUploadingGroupIcon(false)
    }
  }

  async function removeGroupIcon() {
    const oldUrl = convImageUrl
    setConvImageUrl(null)
    const { error } = await supabase.from('conversations').update({ image_url: null }).eq('id', convId)
    if (error) {
      console.error('removeGroupIcon failed:', error)
      setConvImageUrl(oldUrl)
      toast('Failed to remove icon', 'error')
      return
    }
    if (oldUrl) {
      const match = oldUrl.match(/\/chat-images\/(.+)$/)
      if (match) await supabase.storage.from('chat-images').remove([match[1]])
    }
  }

  async function sendImage(tempId, file, previewUrl, replyId, textBody = null) {
    try {
      const { file: compressed, width: imgWidth, height: imgHeight } = await compressImage(file)
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
        image_width:  imgWidth  ?? null,
        image_height: imgHeight ?? null,
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
      const key = `${messageId}:${emoji}`
      setJustReacted(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setJustReacted(prev => { const n = { ...prev }; delete n[key]; return n }), 650)
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
    return result
  }, [filteredMsgs, firstUnreadId])

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

  const typing = useMemo(() => typingLabel(typingUsers), [typingUsers])

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
  const dmOtherMember  = useMemo(() =>
    conversation.type === 'direct' ? members.find(m => m.user_id !== myId) : null,
    [conversation, members, myId]
  )
  const isMainGroupChat = useMemo(() =>
    conversation.type === 'group' && (conversation.conversation_members?.length ?? 0) >= members.length,
    [conversation, members]
  )
  const canEditGroupInfo = useMemo(() =>
    conversation.type === 'group' && (isMainGroupChat ? isAdmin : true),
    [conversation, isMainGroupChat, isAdmin]
  )
  // O(1) member lookup used by MessageList to avoid O(n) find() per bubble
  const memberMap = useMemo(() =>
    Object.fromEntries(members.map(m => [m.user_id, m])),
    [members]
  )

  // ── Render ────────────────────────────────────────────────────────────────
  // Memoized so context consumers don't re-render when unrelated state
  // (e.g. AppContext refresh) causes ChatView to re-render without changing
  // any of its own state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ctxValue = useMemo(() => ({
    // Refs (stable, not in deps)
    scrollRef, messagesContainerRef, textareaRef, fileInputRef, editTextareaRef,
    presenceChannelRef, typingTimeoutRef, savedSelectionRef,
    pollOptionRefs, justAddedOptionRef, pollQuestionRef, groupIconFileRef,
    // Props
    conversation, session, myId, convId, displayName, groupId,
    members, isAdmin,
    // Derived
    filteredMsgs, items, readersAtMessage, typing, title, activeMessage,
    dmOtherMember, isMainGroupChat, canEditGroupInfo, memberMap,
    // State
    messages, loading, visible, contentReady, fetchingFresh, hasMore, loadingMore,
    text, setText, imagePreviews, setImagePreviews,
    searchOpen, setSearchOpen, searchQuery, setSearchQuery,
    isAtBottom, setIsAtBottom,
    typingUsers, reactions, justReacted,
    activeMsg, setActiveMsg, menuPos, menuClosing, closeMenu,
    showMoreEmojis, setShowMoreEmojis,
    reactionPickerClosing, setReactionPickerClosing,
    showEmojiPicker, setShowEmojiPicker,
    notesOpen, setNotesOpen,
    replyingTo, setReplyingTo,
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
    sending,
    // Handlers (functions close over current state; recreated whenever any
    // dep below changes, which is the same moment state actually changed)
    scrollToBottom, handleScroll, loadMore, toggleSearch,
    handleTextInput, handleKeyDown, handleSend, handleFileChange,
    toggleReaction, deleteMessage, openMenuFromEl, exitEdit, openMenu,
    handleDoubleTap, handleLongPressStart, handleLongPressEnd,
    startEdit, handleSaveEdit, handleReply, closeReactionPicker,
    closeEmojiPicker, insertEmoji, retryMessage,
    uploadGroupIcon, removeGroupIcon,
    castVote, rsvpInChat, prayInChat, createPoll, startEditPoll, savePoll, deletePoll,
    handleRenameGroup, scrollToMessage, formatEventDate,
    handleScrollToBottom, onMessageImageLoad, handleImageTap,
    // senderName via memberMap — stable reference, always current
    senderName: (userId, storedName) => memberMap[userId]?.display_name || storedName,
    headerH,
  }), [
    // Props
    conversation, session, myId, convId, displayName, groupId, members, isAdmin,
    // Derived
    filteredMsgs, items, readersAtMessage, typing, title, activeMessage,
    dmOtherMember, isMainGroupChat, canEditGroupInfo, memberMap,
    // State — all must be listed so handlers capture current values
    messages, loading, visible, contentReady, fetchingFresh, hasMore, loadingMore,
    text, imagePreviews, searchOpen, searchQuery, isAtBottom, typingUsers,
    reactions, justReacted, activeMsg, menuPos, menuClosing, showMoreEmojis,
    reactionPickerClosing, showEmojiPicker, notesOpen, replyingTo,
    infoOpen, infoClosing, renamingGroup, renameValue, renameSaving, confirmDeleteMsg,
    editingMsgId, editText, editClosingId, selectedMsgId, confirmDeleteId,
    convName, memberReadTimes, unreadCount, firstUnreadId, openUnreadCount,
    lightboxImg, convImageUrl, uploadingGroupIcon, polls, chatEvents,
    pollCreating, pollQuestion, pollOptions, pollSubmitting, pollMenuOpenId,
    deletingPollId, editingPollId, editPollQuestion, editPollOptions, savingPoll, sending, chatPrayers,
    headerH,
  ])

  return (
    <ChatContext.Provider value={ctxValue}>
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
          className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0"
        >
          <ArrowLeft size={20} weight="bold" />
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
            <p className="text-xs text-stone-400 mt-1.5 px-1">
              {filteredMsgs.length} {filteredMsgs.length === 1 ? 'message' : 'messages'} found
            </p>
          )}
        </div>
      </motion.div>

      </div>{/* end inner measured wrapper */}
      </div>{/* end header outer (safe-area extension) */}

      {/* Unread pill — positioned just below the floating header */}
      {firstUnreadId && !searchOpen && (
        <div className="absolute left-0 right-0 flex justify-center py-1.5 z-[9] animate-overlay-in" style={{ top: `calc(env(safe-area-inset-top) + ${headerH}px)` }}>
          <button
            onClick={() => {
              document.getElementById(`msg-${firstUnreadId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              setFirstUnreadId(null)
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

      <div className="shrink-0">
        <MessageInput />
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
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-colors ${reacted ? 'bg-ember/10' : 'hover:bg-stone-100'}`}
                >
                  {emoji}
                </button>
              )
            })}
            <button
              onClick={() => showMoreEmojis ? closeReactionPicker() : setShowMoreEmojis(true)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-colors ${showMoreEmojis ? 'bg-ember text-white' : 'text-stone-400 hover:bg-stone-100'}`}
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
          <div className={`fixed inset-x-0 bottom-0 z-40 bg-white border-t border-stone-100 shadow-xl ${reactionPickerClosing ? 'animate-sheet-out' : 'animate-modal-in'}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)', overscrollBehavior: 'contain' }}>
            <Suspense fallback={null}>
              <EmojiPicker
                onEmojiClick={emojiData => toggleReaction(activeMsg, emojiData.emoji)}
                width="100%"
                height={350}
                searchPlaceholder="Search emojis…"
                previewConfig={{ showPreview: false }}
                autoFocusSearch={false}
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

      {/* Image lightbox */}
      {(lightboxImg || lightboxClosing) && (
        <div
          className={`fixed inset-0 z-50 bg-black/90 flex items-center justify-center ${lightboxClosing ? 'animate-backdrop-out' : 'animate-overlay-in'}`}
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={20} weight="bold" />
          </button>
          <img
            src={lightboxImg}
            alt="Full size"
            className={`max-w-full max-h-full object-contain rounded-lg transition-transform duration-[250ms] ease-in ${lightboxClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
            style={{ maxHeight: 'calc(100svh - 80px)', maxWidth: 'calc(100vw - 32px)' }}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
    </ChatContext.Provider>
  )
}
