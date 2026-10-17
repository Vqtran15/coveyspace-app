import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'

export function usePollActions({
  convId, groupId, myId, displayName, members,
  replyingTo, setReplyingTo,
  setMessages, messagesRef,
  isAtBottomRef, setIsAtBottom,
  freshLoadRef, scrollToBottom,
  mountedRef,
  toast,
}) {
  const [polls, setPolls]                         = useState({})
  const [chatEvents, setChatEvents]               = useState({})
  const [chatPrayers, setChatPrayers]             = useState({})
  const [pollCreating, setPollCreating]           = useState(false)
  const [pollQuestion, setPollQuestion]           = useState('')
  const [pollOptions, setPollOptions]             = useState(['', ''])
  const [pollSubmitting, setPollSubmitting]       = useState(false)
  const [pollMenuOpenId, setPollMenuOpenId]       = useState(null)
  const [deletingPollId, setDeletingPollId]       = useState(null)
  const [editingPollId, setEditingPollId]         = useState(null)
  const [editPollQuestion, setEditPollQuestion]   = useState('')
  const [editPollOptions, setEditPollOptions]     = useState([])
  const [savingPoll, setSavingPoll]               = useState(false)

  const pollOptionRefs     = useRef([])
  const justAddedOptionRef = useRef(false)
  const pollQuestionRef    = useRef(null)

  // Stale-safe refs for async callbacks that need current values post-await.
  const pollsRef       = useRef(polls)
  const chatEventsRef  = useRef(chatEvents)
  const chatPrayersRef = useRef(chatPrayers)
  pollsRef.current       = polls
  chatEventsRef.current  = chatEvents
  chatPrayersRef.current = chatPrayers

  useEffect(() => {
    setPolls({})
    setChatEvents({})
    setChatPrayers({})
    setPollCreating(false)
    setPollQuestion('')
    setPollOptions(['', ''])
    setPollSubmitting(false)
    setPollMenuOpenId(null)
    setDeletingPollId(null)
    setEditingPollId(null)
    setSavingPoll(false)
  }, [convId])

  useEffect(() => {
    const pollVotesCh = supabase
      .channel(`poll-votes:${convId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `community_group_id=eq.${groupId}` }, ({ new: v, old: o, eventType }) => {
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
    return () => supabase.removeChannel(pollVotesCh)
  }, [convId, groupId])

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
    const pr = chatPrayersRef.current[prayerReqId]
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
    const ev = chatEventsRef.current[eventId]
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
      await supabase.from('event_rsvps').upsert({ event_id: eventId, user_id: myId, status, community_group_id: groupId }, { onConflict: 'event_id,user_id' })
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

      const pollData = { question, options: opts.map(text => ({ text })), votes: [] }

      // Update polls + messages in the same synchronous block so they land in one React render.
      // Embed _poll on the message as a fallback in case polls state races the realtime INSERT.
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
      toast('Failed to create poll', 'error')
    } finally {
      setPollSubmitting(false)
    }
  }

  async function castVote(pollId, optionIndex) {
    const prevPoll = pollsRef.current[pollId]
    setPolls(prev => {
      if (!prev[pollId]) return prev
      const p = prev[pollId]
      return { ...prev, [pollId]: { ...p, votes: [...p.votes.filter(v => v.user_id !== myId), { poll_id: pollId, user_id: myId, option_index: optionIndex }] } }
    })
    const { error } = await supabase.from('poll_votes').upsert({ poll_id: pollId, user_id: myId, option_index: optionIndex })
    if (error) {
      console.error('castVote error:', error)
      if (prevPoll) setPolls(prev => ({ ...prev, [pollId]: prevPoll }))
      toast('Failed to cast vote', 'error')
    }
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
      toast('Failed to save poll', 'error')
    } finally {
      setSavingPoll(false)
    }
  }

  async function deletePoll(pollId, messageId) {
    setPollMenuOpenId(null)
    setDeletingPollId(pollId)
    const msgSnapshot  = messagesRef.current.find(m => m.id === messageId)
    const pollSnapshot = pollsRef.current[pollId]
    await new Promise(r => setTimeout(r, 260))
    if (!mountedRef.current) return
    setMessages(prev => prev.filter(m => m.id !== messageId))
    setPolls(prev => { const next = { ...prev }; delete next[pollId]; return next })
    setDeletingPollId(null)
    const [{ error: msgErr }, { error: pollErr }] = await Promise.all([
      supabase.from('messages').delete().eq('id', messageId),
      supabase.from('polls').delete().eq('id', pollId),
    ])
    if (!mountedRef.current) return
    if (msgErr || pollErr) {
      if (msgSnapshot) setMessages(prev => [...prev, msgSnapshot].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
      if (pollSnapshot) setPolls(prev => ({ ...prev, [pollId]: pollSnapshot }))
      toast('Failed to delete poll', 'error')
    }
  }

  return {
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
  }
}
