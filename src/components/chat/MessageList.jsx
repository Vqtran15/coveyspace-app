import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDown, MagnifyingGlass, ChartBar,
  CalendarHeart, CheckCircle, Minus, MapPin,
  PencilSimple, Trash, Check, X, DotsThreeVertical,
  Plus as PlusIcon, HandsPraying,
} from '@phosphor-icons/react'
import { AvatarIcon, AvatarCircle, avatarColor } from '../../lib/avatarIcons.jsx'
import { initials, formatMessageTime } from '../../utils/format.js'
import { useChatContext } from './ChatContext.jsx'

const GROUP_TIME_GAP = 5 * 60 * 1000

const REACTION_PARTICLES = [
  { dx: 0,   dy: -22 },
  { dx: 16,  dy: -16 },
  { dx: 22,  dy: 0   },
  { dx: 16,  dy: 16  },
  { dx: 0,   dy: 22  },
  { dx: -16, dy: -16 },
]
function ReactionParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {REACTION_PARTICLES.map((p, i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full bg-ember"
          style={{ marginLeft: -3, marginTop: -3 }}
          initial={{ x: 0, y: 0, scale: 1, opacity: 0.85 }}
          animate={{ x: p.dx, y: p.dy, scale: 0, opacity: 0 }}
          transition={{ duration: 0.4, delay: i * 0.02, ease: [0.32, 0, 0.67, 0] }}
        />
      ))}
    </div>
  )
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

export default function MessageList() {
  const {
    scrollRef, messagesContainerRef, handleScroll,
    loadingMore, visible, contentReady, loading, fetchingFresh,
    filteredMsgs, items, searchQuery, searchOpen,
    firstUnreadId, setFirstUnreadId, openUnreadCount,
    isAtBottom, unreadCount, handleScrollToBottom,
    reactions, justReacted, polls, chatEvents, members, memberMap, myId,
    editingMsgId, editText, setEditText, editTextareaRef, editClosingId,
    selectedMsgId, setSelectedMsgId, confirmDeleteId, setConfirmDeleteId,
    deletingPollId, pollMenuOpenId, setPollMenuOpenId,
    editingPollId, setEditingPollId,
    editPollQuestion, setEditPollQuestion,
    editPollOptions, setEditPollOptions,
    savingPoll,
    readersAtMessage,
    senderName, scrollToMessage, formatEventDate,
    handleDoubleTap, handleLongPressStart, handleLongPressEnd,
    startEdit, handleSaveEdit, exitEdit, openMenu,
    castVote, rsvpInChat, prayInChat,
    chatPrayers,
    startEditPoll, savePoll, deletePoll,
    deleteMessage,
    toggleReaction,
    handleImageTap, onMessageImageLoad,
    retryMessage,
    conversation,
    headerH,
    inputH,
  } = useChatContext()

  // Pre-parse every message body so the URL regex doesn't run on every render
  const renderedBodies = useMemo(() => {
    const map = {}
    for (const item of items) {
      if (item.type === 'msg' && item.msg.body) {
        map[item.msg.id] = renderMessageBody(item.msg.body, searchQuery)
      }
    }
    return map
  }, [items, searchQuery])

  return (
    <div className="relative flex-1 min-h-0">
      <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4 max-w-3xl mx-auto w-full" style={{ paddingTop: `calc(env(safe-area-inset-top) + ${headerH}px)`, paddingBottom: `${inputH}px` }}>
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
        {!visible && (
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

              if (item.type === 'unread') {
                return (
                  <div key="unread-divider" className="flex items-center gap-3 py-2 mx-1">
                    <div className="flex-1 h-px bg-ember/30" />
                    <span className="text-xs font-semibold text-ember/80 shrink-0 tracking-wide">New Messages</span>
                    <div className="flex-1 h-px bg-ember/30" />
                  </div>
                )
              }

              const { msg } = item
              const isOwn = msg.user_id === myId
              const nextItem = items[i + 1]
              const prevItem = items[i - 1]
              const isLastInGroup  = nextItem?.type !== 'msg' || nextItem.msg.user_id !== msg.user_id || new Date(nextItem.msg.created_at) - new Date(msg.created_at) > GROUP_TIME_GAP
              const isFirstInGroup = prevItem?.type !== 'msg' || prevItem.msg.user_id !== msg.user_id || new Date(msg.created_at) - new Date(prevItem.msg.created_at) > GROUP_TIME_GAP
              const prevIsImage = prevItem?.type === 'msg' && !!prevItem.msg.image_url
              const msgReactions = reactions[msg.id]
              const hasReactions = msgReactions && Object.keys(msgReactions).length > 0

              // ── Poll card ──────────────────────────────────────────────────
              if (msg.poll_id) {
                const poll = polls[msg.poll_id] ?? msg._poll
                if (!poll) return (
                  <div key={msg.id} id={`msg-${msg.id}`} className="!mt-3 !mb-5">
                    <div className="bg-stone-100 rounded-2xl h-28 animate-pulse" />
                  </div>
                )
                const isEditing = editingPollId === msg.poll_id
                const myVote = poll.votes.find(v => v.user_id === myId)?.option_index ?? null
                const totalVotes = poll.votes.length
                return (
                  <div
                    id={`msg-${msg.id}`}
                    key={msg.id}
                    className={`!mt-3 !mb-5 ${msg._isNew ? 'animate-msg-in-left' : ''} ${deletingPollId === msg.poll_id ? 'animate-poll-delete-out pointer-events-none' : ''}`}
                  >
                    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">

                      {/* Header */}
                      <div className="px-4 pt-3 pb-2 border-b border-stone-100 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">
                            <ChartBar size={11} weight="bold" />
                            {isEditing ? 'Edit Poll' : `Poll · ${senderName(msg.user_id, msg.display_name)}`}
                          </div>
                          {!isEditing && <p className="text-sm font-bold text-stone-800 leading-snug">{poll.question}</p>}
                        </div>

                        {/* Dots menu — creator only */}
                        {isOwn && !isEditing && (
                          <div className="relative shrink-0">
                            <button
                              onClick={() => setPollMenuOpenId(prev => prev === msg.poll_id ? null : msg.poll_id)}
                              className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
                            >
                              <DotsThreeVertical size={16} weight="bold" />
                            </button>
                            {pollMenuOpenId === msg.poll_id && (
                              <div className="fixed inset-0 z-40" onClick={() => setPollMenuOpenId(null)} />
                            )}
                            <AnimatePresence>
                              {pollMenuOpenId === msg.poll_id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.88, y: -6 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.88, y: -6 }}
                                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                                  style={{ transformOrigin: 'top right' }}
                                  className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-lg border border-stone-200 py-1 min-w-[130px]"
                                >
                                  <button
                                    onClick={() => startEditPoll(msg.poll_id, poll)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                                  >
                                    <PencilSimple size={14} weight="bold" />
                                    Edit poll
                                  </button>
                                  <button
                                    onClick={() => deletePoll(msg.poll_id, msg.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                                  >
                                    <Trash size={14} weight="bold" />
                                    Delete poll
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>

                      {/* Content — AnimatePresence swaps edit form ↔ voting view */}
                      <AnimatePresence mode="wait" initial={false}>
                        {isEditing ? (
                          <motion.div
                            key="edit"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="px-4 py-3 flex flex-col gap-2"
                          >
                            <input
                              type="text"
                              value={editPollQuestion}
                              onChange={e => setEditPollQuestion(e.target.value)}
                              placeholder="Question"
                              className="w-full text-sm font-medium text-stone-800 border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ember/30"
                            />
                            {editPollOptions.map((opt, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={e => {
                                    const next = [...editPollOptions]
                                    next[i] = e.target.value
                                    setEditPollOptions(next)
                                  }}
                                  placeholder={`Option ${i + 1}`}
                                  className="flex-1 text-sm border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ember/30"
                                />
                                {editPollOptions.length > 2 && (
                                  <button
                                    onClick={() => setEditPollOptions(prev => prev.filter((_, j) => j !== i))}
                                    className="text-stone-400 hover:text-red-400 transition-colors"
                                  >
                                    <X size={14} weight="bold" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {editPollOptions.length < 10 && (
                              <button
                                onClick={() => setEditPollOptions(prev => [...prev, ''])}
                                className="self-start flex items-center gap-1 text-xs text-ember font-semibold"
                              >
                                <PlusIcon size={12} weight="bold" /> Add option
                              </button>
                            )}
                            <p className="text-[10px] text-stone-400">Saving will reset all votes.</p>
                            <div className="flex gap-2 mt-0.5">
                              <button
                                onClick={() => setEditingPollId(null)}
                                className="flex-1 py-2 text-sm font-semibold text-stone-500 border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => savePoll(msg.poll_id)}
                                disabled={!editPollQuestion.trim() || editPollOptions.filter(o => o.trim()).length < 2 || savingPoll}
                                className="flex-1 py-2 text-sm font-semibold text-white bg-ember rounded-xl disabled:opacity-40 transition-colors"
                              >
                                {savingPoll ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="vote"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                          >
                            <div className="px-4 py-3 flex flex-col gap-2">
                              {poll.options.map((opt, oi) => {
                                const voteCount = poll.votes.filter(v => v.option_index === oi).length
                                const pct = totalVotes ? Math.round((voteCount / totalVotes) * 100) : 0
                                const voted = myVote === oi
                                return (
                                  <button
                                    key={oi}
                                    onClick={() => castVote(msg.poll_id, oi)}
                                    className={`relative w-full text-left px-3 py-2.5 rounded-xl border-2 overflow-hidden transition-colors ${voted ? 'border-ember' : 'border-stone-200 hover:border-stone-300'}`}
                                  >
                                    <div
                                      className={`absolute inset-y-0 left-0 transition-all duration-500 ${voted ? 'bg-ember/10' : 'bg-stone-50'}`}
                                      style={{ width: `${Math.max(pct, 4)}%` }}
                                    />
                                    <div className="relative flex items-center justify-between">
                                      <span className={`text-sm font-medium ${voted ? 'text-ember' : 'text-stone-700'}`}>{opt.text}</span>
                                      <span className="text-xs text-stone-400 font-semibold ml-3 shrink-0">{pct}%</span>
                                    </div>
                                  </button>
                                )
                              })}
                              <p className="text-[10px] text-stone-400 mt-0.5">
                                {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                                {myVote !== null ? ' · Tap to change vote' : ' · Tap to vote'}
                              </p>
                            </div>
                            <div className="px-4 pb-2.5 text-right">
                              <span className="text-[10px] text-stone-400">{formatMessageTime(msg.created_at)}</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )
              }

              if (msg.prayer_request_id) {
                const pr = chatPrayers[msg.prayer_request_id]
                if (!pr) return (
                  <div key={msg.id} id={`msg-${msg.id}`} className="!mt-3 !mb-5">
                    <div className="bg-stone-100 rounded-2xl h-24 animate-pulse" />
                  </div>
                )
                const hasReacted = pr.reactions.some(rx => rx.user_id === myId)
                const reactionCount = pr.reactions.length
                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className={`!mt-3 !mb-5 ${msg._isNew ? 'animate-msg-in-left' : ''}`}>
                    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
                      {/* Header */}
                      <div className="px-4 pt-3 pb-2.5 border-b border-stone-100">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">
                          <HandsPraying size={11} weight="bold" />
                          {`Prayer Request · ${senderName(msg.user_id, msg.display_name)}`}
                        </div>
                        {/* Who the prayer is for */}
                        {pr.member && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-6 h-6 rounded-full shrink-0 overflow-hidden flex items-center justify-center ${pr.member.avatar_image_url ? 'bg-stone-200' : `${avatarColor(pr.member.user_id, pr.member.avatar_color)}`}`}>
                              {pr.member.avatar_image_url
                                ? <img src={pr.member.avatar_image_url} alt="" className="w-full h-full object-cover" />
                                : pr.member.avatar_icon
                                  ? <AvatarIcon name={pr.member.avatar_icon} size={10} />
                                  : <span className="text-white text-[8px] font-bold">{(pr.member.display_name ?? '?').charAt(0).toUpperCase()}</span>
                              }
                            </div>
                            <span className="text-xs font-semibold text-stone-600">For {pr.member.display_name}</span>
                          </div>
                        )}
                        <p className="text-sm text-stone-700 leading-relaxed line-clamp-4">{pr.request}</p>
                      </div>
                      {/* Pray button + timestamp */}
                      <div className="px-4 py-2.5 flex items-center gap-3">
                        <button
                          onClick={() => prayInChat(msg.prayer_request_id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${hasReacted ? 'bg-ember text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                        >
                          <HandsPraying size={15} weight={hasReacted ? 'fill' : 'regular'} />
                          {hasReacted ? 'Praying' : 'Pray'}
                          {reactionCount > 0 && <span className={`text-xs ${hasReacted ? 'text-white/80' : 'text-stone-400'}`}>{reactionCount}</span>}
                        </button>
                        <span className="ml-auto text-[10px] text-stone-400">{formatMessageTime(msg.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              }

              if (msg.event_id) {
                const ev = chatEvents[msg.event_id]
                if (!ev) return (
                  <div key={msg.id} id={`msg-${msg.id}`} className="!mt-3 !mb-5">
                    <div className="bg-stone-100 rounded-2xl h-28 animate-pulse" />
                  </div>
                )
                const myEvRsvp = ev.rsvps.find(r => r.user_id === myId)
                const { goingCount, maybeCount, notGoingCount, goingRsvps } = ev.rsvps.reduce(
                  (acc, r) => {
                    if (r.status === 'going') { acc.goingCount++; if (acc.goingRsvps.length < 4) acc.goingRsvps.push(r) }
                    else if (r.status === 'maybe') acc.maybeCount++
                    else acc.notGoingCount++
                    return acc
                  },
                  { goingCount: 0, maybeCount: 0, notGoingCount: 0, goingRsvps: [] }
                )
                return (
                  <div key={msg.id} id={`msg-${msg.id}`} className={`!mt-3 !mb-5 ${msg._isNew ? 'animate-msg-in-left' : ''}`}>
                    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
                      {/* Header */}
                      <div className="px-4 pt-3 pb-2 border-b border-stone-100">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">
                          <CalendarHeart size={11} weight="bold" />
                          {`Event · ${senderName(msg.user_id, msg.display_name)}`}
                        </div>
                        <p className="text-sm font-bold text-stone-800 leading-snug">{ev.title}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{formatEventDate(ev.event_date, ev.event_time)}</p>
                        {ev.location && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin size={11} className="text-stone-400 shrink-0" />
                            <p className="text-xs text-stone-500 truncate">{ev.location}</p>
                          </div>
                        )}
                      </div>
                      {/* RSVP buttons */}
                      <div className="px-4 py-3 flex gap-2">
                        {[
                          { status: 'going',     label: 'Going',    Icon: CheckCircle, active: 'bg-ember text-white',      inactive: 'bg-stone-100 text-stone-600' },
                          { status: 'maybe',     label: 'Maybe',    Icon: Minus,       active: 'bg-lagoon-700 text-white', inactive: 'bg-stone-100 text-stone-600' },
                          { status: 'not_going', label: "Can't go", Icon: X,           active: 'bg-stone-500 text-white', inactive: 'bg-stone-100 text-stone-600' },
                        ].map(({ status, label, Icon, active, inactive }) => (
                          <button
                            key={status}
                            onClick={() => rsvpInChat(msg.event_id, status)}
                            className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-colors ${myEvRsvp?.status === status ? active : inactive}`}
                          >
                            <Icon size={16} weight={myEvRsvp?.status === status ? 'fill' : 'regular'} />
                            {label}
                          </button>
                        ))}
                      </div>
                      {/* Count + timestamp */}
                      <div className="px-4 pb-3 flex items-center gap-2">
                        {goingRsvps.map((r, i) => (
                          <div
                            key={r.user_id}
                            className={`w-5 h-5 rounded-full border-2 border-white shrink-0 overflow-hidden ${r.profile?.avatar_image_url ? 'bg-stone-200' : `${avatarColor(r.user_id, r.profile?.avatar_color)} flex items-center justify-center`}`}
                            style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 4 - i }}
                          >
                            {r.profile?.avatar_image_url
                              ? <img src={r.profile.avatar_image_url} alt="" className="w-full h-full object-cover" />
                              : <span className="text-white text-[7px] font-bold">{(r.profile?.display_name ?? '?').charAt(0).toUpperCase()}</span>
                            }
                          </div>
                        ))}
                        <span className="text-xs text-stone-400">
                          {[goingCount && `${goingCount} going`, maybeCount && `${maybeCount} maybe`, notGoingCount && `${notGoingCount} can't go`].filter(Boolean).join(' · ') || 'No RSVPs yet'}
                        </span>
                        <span className="ml-auto text-[10px] text-stone-400">{formatMessageTime(msg.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  id={`msg-${msg.id}`}
                  key={msg.id}
                  className={`flex gap-2 select-none ${isOwn ? 'justify-end' : 'justify-start'} ${msg.image_url && !prevIsImage ? '!mt-3' : ''} ${msg.image_url ? '!mb-3' : isLastInGroup && !hasReactions ? 'mb-2' : 'mb-0'}`}
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
                      {isFirstInGroup && (() => { const m = memberMap[msg.user_id]; return <AvatarCircle size="8" name={senderName(msg.user_id, msg.display_name)} userId={msg.user_id} icon={m?.avatar_icon} colorKey={m?.avatar_color} imageUrl={m?.avatar_image_url} /> })()}
                    </div>
                  )}

                  <div className={`flex flex-col min-w-0 max-w-[75%] ${msg._isNew ? (isOwn ? 'animate-msg-in-right' : 'animate-msg-in-left') : ''}`}>
                    {!isOwn && isFirstInGroup && (
                      <p className="text-xs font-semibold text-stone-500 mb-2 ml-1">{senderName(msg.user_id, msg.display_name)}</p>
                    )}
                    <div className="relative w-full">
                    <div className={`overflow-hidden select-none transition-colors duration-200
                      ${editingMsgId === msg.id ? 'animate-edit-pop' : editClosingId === msg.id ? 'animate-edit-close' : ''}
                      ${isOwn
                        ? `${editingMsgId === msg.id ? 'bg-stone-600' : 'bg-ember'} text-white ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? `rounded-bl-2xl ${msg.image_url ? 'rounded-br-sm' : 'rounded-br-none'}` : 'rounded-b-md'}`
                        : `bg-white border border-stone-200 text-stone-800 ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? `rounded-br-2xl ${msg.image_url ? 'rounded-bl-sm' : 'rounded-bl-none'}` : 'rounded-b-md'}`
                      }`}>
                      {/* Reply quote */}
                      {msg.reply_message && (
                        <button
                          onClick={() => scrollToMessage(msg.reply_message.id)}
                          className={`w-full text-left mx-0 px-3 pt-2.5 pb-1.5 border-b ${isOwn ? 'border-white/20' : 'border-stone-100'}`}
                        >
                          <div className={`min-w-0 pl-2 border-l-2 ${isOwn ? 'border-white/60' : 'border-ember'}`}>
                            <p className={`text-[11px] font-semibold truncate ${isOwn ? 'text-white/90' : 'text-ember'}`}>
                              {senderName(msg.reply_message.user_id, msg.reply_message.display_name)}
                            </p>
                            <p className={`text-[11px] truncate ${isOwn ? 'text-white/90' : 'text-stone-500'}`}>
                              {msg.reply_message.image_url && !msg.reply_message.body ? '📷 Photo' : msg.reply_message.body}
                            </p>
                          </div>
                        </button>
                      )}
                      {msg.image_url && (
                        msg._pending || msg._failed ? (
                          <div className="relative">
                            <img src={msg.image_url} alt="shared" className="block" style={{ maxWidth: '100%', maxHeight: 280, width: 'auto', height: 'auto' }} loading="lazy" />
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
                            {...(msg.image_width && msg.image_height
                              ? { width: msg.image_width, height: msg.image_height }
                              : {})}
                            className="block cursor-pointer"
                            style={{ maxWidth: '100%', maxHeight: 280, width: 'auto', height: 'auto', WebkitTouchCallout: 'none' }}
                            onLoad={onMessageImageLoad}
                            onContextMenu={e => e.preventDefault()}
                            onClick={e => handleImageTap(e, msg.id, isOwn, msg.image_url)}
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
                            <button type="button" onClick={exitEdit} className="text-[11px] text-white/90 hover:text-white font-medium transition-colors">
                              Cancel
                            </button>
                            <button type="submit" disabled={!editText.trim()} className="text-[11px] text-white font-semibold disabled:opacity-40 transition-opacity">
                              Save
                            </button>
                          </div>
                        </form>
                      ) : msg.body && (
                        <p className={`px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${editClosingId === msg.id ? 'animate-overlay-in' : ''}`}>
                          {renderedBodies[msg.id]}
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
                      <p className={`text-[10px] mt-1 ${isOwn ? 'mr-1 text-right' : 'ml-1'} ${msg._failed ? 'text-red-400' : 'text-stone-400'}`}>
                        {msg._pending ? 'Sending…' : msg._failed ? 'Failed to send' : formatMessageTime(msg.created_at)}
                      </p>
                    )}

                    {hasReactions && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : ''} ${isLastInGroup ? 'mb-2' : 'mb-0'}`}>
                        {Object.entries(msgReactions).map(([emoji, users]) => {
                          const isNew = justReacted[`${msg.id}:${emoji}`]
                          const isMine = users.some(u => u.user_id === myId)
                          return (
                            <div key={emoji} className="relative">
                              <AnimatePresence>
                                {isNew && <ReactionParticles key="particles" />}
                              </AnimatePresence>
                              <motion.button
                                onClick={() => toggleReaction(msg.id, emoji)}
                                animate={isNew ? { scale: [1, 0.86, 1.32, 0.94, 1] } : { scale: 1 }}
                                transition={isNew ? { duration: 0.42, times: [0, 0.15, 0.5, 0.75, 1] } : { type: 'spring', stiffness: 400, damping: 25 }}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                                  isMine
                                    ? 'bg-ember/10 border-ember/40 text-ember font-medium'
                                    : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span>{users.length}</span>
                              </motion.button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {isOwn && readersAtMessage[msg.id]?.length > 0 && (
                      <div className="flex gap-0.5 mt-1 justify-end">
                        {readersAtMessage[msg.id].slice(0, 6).map(member => (
                          <div
                            key={member.user_id}
                            title={member.display_name}
                            className={`w-4 h-4 rounded-full shrink-0 overflow-hidden ${member.avatar_image_url ? 'bg-stone-200' : `flex items-center justify-center ${avatarColor(member.user_id, member.avatar_color)}`}`}
                          >
                            {member.avatar_image_url
                              ? <img src={member.avatar_image_url} alt="" className="w-full h-full object-cover" />
                              : member.avatar_icon
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
        <div className="absolute inset-x-0 flex justify-center z-10 animate-overlay-in pointer-events-none" style={{ bottom: `${inputH + 12}px` }}>
          <button
            onClick={handleScrollToBottom}
            className="pointer-events-auto relative w-9 h-9 bg-ember text-white rounded-full shadow-lg flex items-center justify-center"
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
  )
}
