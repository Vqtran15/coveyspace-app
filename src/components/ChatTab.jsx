import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import ConversationList from './ConversationList.jsx'
import ChatView from './ChatView.jsx'

export default function ChatTab({ session, displayName, groupId, onRead }) {
  const [activeConv, setActiveConv]   = useState(null)
  const [members, setMembers]         = useState([])
  const [chatExiting, setChatExiting] = useState(false)
  const [listClass, setListClass]     = useState('')

  useEffect(() => {
    if (!groupId) return
    supabase
      .from('profiles')
      .select('user_id, display_name')
      .eq('community_group_id', groupId)
      .then(({ data }) => setMembers(data ?? []))
  }, [groupId])

  function openConv(conv) {
    setListClass('')
    setActiveConv(conv)
    supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conv.id)
      .eq('user_id', session.user.id)
      .then(() => {})
  }

  function goBack() {
    setChatExiting(true)
    setTimeout(() => {
      setChatExiting(false)
      setActiveConv(null)
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
        exiting={chatExiting}
        onBack={goBack}
        onRead={onRead}
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
    />
  )
}
