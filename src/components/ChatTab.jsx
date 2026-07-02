import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import ConversationList from './ConversationList.jsx'
import ChatView from './ChatView.jsx'

export default function ChatTab({ session, displayName, groupId, isAdmin, onRead, onOpenSettings, upcoming = [] }) {
  const [activeConv, setActiveConv]           = useState(null)
  const [capturedLastReadAt, setCapturedLastReadAt] = useState(null)
  const [readAtMap, setReadAtMap]             = useState({})
  const [members, setMembers]                 = useState([])
  const [chatExiting, setChatExiting]         = useState(false)
  const [listClass, setListClass]             = useState('')

  // Prevent iOS from scrolling the window when the keyboard appears.
  // Without this, tapping the message input causes window.scrollY to drift,
  // leaving a gap between the input bar and the nav bar after sending.
  useEffect(() => {
    const prev = { position: document.body.style.position, width: document.body.style.width, overflow: document.body.style.overflow }
    document.body.style.position = 'fixed'
    document.body.style.width    = '100%'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = prev.position
      document.body.style.width    = prev.width
      document.body.style.overflow = prev.overflow
    }
  }, [])

  useEffect(() => {
    if (!groupId) return
    supabase
      .from('profiles')
      .select('user_id, display_name, role, avatar_icon, avatar_color')
      .eq('community_group_id', groupId)
      .then(({ data }) => setMembers(data ?? []))
  }, [groupId])

  useEffect(() => {
    if (!displayName || !session.user.id) return
    setMembers(prev => prev.map(m =>
      m.user_id === session.user.id ? { ...m, display_name: displayName } : m
    ))
  }, [displayName])

  function openConv(conv, dbLastReadAt = null) {
    // Pick the most recent of: in-memory close time, localStorage (survives reloads),
    // or DB value — localStorage is synchronous so it has no race condition
    const localReadAt = localStorage.getItem(`readAt:${conv.id}`)
    const best = [readAtMap[conv.id], localReadAt, dbLastReadAt].filter(Boolean).sort().pop() ?? null
    console.log('[chat] openConv', { convId: conv.id, readAtMap: readAtMap[conv.id], localReadAt, dbLastReadAt, best })
    setCapturedLastReadAt(best)
    setListClass('')
    setActiveConv(conv)
    supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conv.id)
      .eq('user_id', session.user.id)
      .then(({ error }) => { if (error) console.error('Failed to mark read:', error.message) })
  }

  function goBack() {
    setChatExiting(true)
    if (activeConv) {
      setReadAtMap(prev => ({ ...prev, [activeConv.id]: new Date().toISOString() }))
    }
    setTimeout(() => {
      setChatExiting(false)
      setActiveConv(null)
      setCapturedLastReadAt(null)
      setListClass('animate-slide-in-left')
      setTimeout(() => setListClass(''), 250)
    }, 200)
  }

  if (activeConv) {
    return (
      <ChatView
        conversation={activeConv}
        session={session}
        displayName={displayName}
        groupId={groupId}
        members={members}
        isAdmin={isAdmin}
        exiting={chatExiting}
        onBack={goBack}
        onRead={onRead}
        openedWithLastReadAt={capturedLastReadAt}
      />
    )
  }

  return (
    <ConversationList
      session={session}
      groupId={groupId}
      members={members}
      enterClass={listClass}
      onSelect={openConv}
      onRead={onRead}
      onOpenSettings={onOpenSettings}
      upcoming={upcoming}
    />
  )
}
