import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import ConversationList from './ConversationList.jsx'
import ChatView from './ChatView.jsx'

export default function ChatTab({ session, displayName, groupId, isAdmin, onRead, onOpenSettings, upcoming = [], birthdayBannerDismissed, birthdayBannerClosing, onDismissBirthdayBanner, onOpenBirthdays, pushSupported, pushSubscribed, pushPermission, pushToggling, onPushToggle }) {
  const { state: locationState } = useLocation()
  const navigateRouter = useNavigate()
  const [autoOpenGroupChat, setAutoOpenGroupChat] = useState(!!locationState?.openGroupChat)
  const consumeAutoOpen = useCallback(() => setAutoOpenGroupChat(false), [])
  const [activeConv, setActiveConv]           = useState(null)
  const [openedWithLastReadAt, setOpenedWithLastReadAt] = useState(null)
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
    if (locationState?.openGroupChat) {
      navigateRouter('.', { replace: true, state: null })
    }
  }, [])

  useEffect(() => {
    if (!groupId) return
    supabase
      .from('profiles')
      .select('user_id, display_name, role, avatar_icon, avatar_color, avatar_image_url')
      .eq('community_group_id', groupId)
      .then(({ data }) => setMembers(data ?? []))
  }, [groupId])

  useEffect(() => {
    if (!displayName || !session.user.id) return
    setMembers(prev => prev.map(m =>
      m.user_id === session.user.id ? { ...m, display_name: displayName } : m
    ))
  }, [displayName])

  function openConv(conv) {
    setOpenedWithLastReadAt(localStorage.getItem(`readAt:${conv.id}`))
    setListClass('')
    setActiveConv(conv)
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
        isAdmin={isAdmin}
        exiting={chatExiting}
        onBack={goBack}
        onRead={onRead}
        openedWithLastReadAt={openedWithLastReadAt}
      />
    )
  }

  return (
    <ConversationList
      session={session}
      groupId={groupId}
      members={members}
      enterClass={listClass}
      autoOpenGroupChat={autoOpenGroupChat}
      onAutoOpenConsumed={consumeAutoOpen}
      onSelect={openConv}
      onRead={onRead}
      onOpenSettings={onOpenSettings}
      upcoming={upcoming}
      birthdayBannerDismissed={birthdayBannerDismissed}
      birthdayBannerClosing={birthdayBannerClosing}
      onDismissBirthdayBanner={onDismissBirthdayBanner}
      onOpenBirthdays={onOpenBirthdays}
      pushSupported={pushSupported}
      pushSubscribed={pushSubscribed}
      pushPermission={pushPermission}
      pushToggling={pushToggling}
      onPushToggle={onPushToggle}
    />
  )
}
