import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import ConversationList from './ConversationList.jsx'
import ChatView from './ChatView.jsx'
import { useAppContext } from '../contexts/AppContext.jsx'

export default function ChatTab({ upcoming = [], birthdayBannerDismissed, birthdayBannerClosing, onDismissBirthdayBanner, onOpenBirthdays }) {
  const { session, displayName, groupId, isAdmin, push, setUnreadChatCount } = useAppContext()
  const onRead = () => setUnreadChatCount(0)
  const location = useLocation()
  const locationState = location.state
  const navigateRouter = useNavigate()
  function onOpenSettings() { navigateRouter('/settings') }
  const tabResetRef = useRef(location.state?.tabReset ?? null)
  const [autoOpenGroupChat, setAutoOpenGroupChat] = useState(!!locationState?.openGroupChat)
  const consumeAutoOpen = useCallback(() => setAutoOpenGroupChat(false), [])
  const [autoOpenMainChat, setAutoOpenMainChat] = useState(!!locationState?.openMainChat)
  const consumeAutoOpenMain = useCallback(() => setAutoOpenMainChat(false), [])
  const [activeConv, setActiveConv]           = useState(null)
  const [openedWithLastReadAt, setOpenedWithLastReadAt] = useState(null)
  const [members, setMembers]                 = useState([])
  const [chatExiting, setChatExiting]         = useState(false)
  const [listClass, setListClass]             = useState('')
  const [pinnedGroupId, setPinnedGroupId]     = useState(null)

  // Scroll to top synchronously before paint so the body-lock below applies at
  // offset 0. Without this, navigating here from a scrolled home screen would
  // lock the body with top:-scrollYpx, shifting ChatView above the viewport
  // and leaving the input bar floating mid-screen with empty space around it.
  useLayoutEffect(() => { window.scrollTo(0, 0) }, [])

  // Prevent iOS from scrolling the window when the keyboard appears.
  // Without this, tapping the message input causes window.scrollY to drift,
  // leaving a gap between the input bar and the nav bar after sending.
  useEffect(() => {
    const prev = { position: document.body.style.position, top: document.body.style.top, width: document.body.style.width }
    document.body.style.top      = ''
    document.body.style.position = 'fixed'
    document.body.style.width    = '100%'
    return () => {
      document.body.style.position = prev.position
      document.body.style.top      = prev.top
      document.body.style.width    = prev.width
    }
  }, [])

  useEffect(() => {
    if (locationState?.openGroupChat || locationState?.openMainChat) {
      navigateRouter('.', { replace: true, state: null })
    }
  }, [])

  useEffect(() => { setPinnedGroupId(null) }, [groupId])

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

  useEffect(() => {
    const reset = location.state?.tabReset
    if (reset && reset !== tabResetRef.current) {
      tabResetRef.current = reset
      if (activeConv) goBack()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.tabReset])

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
      autoOpenMainChat={autoOpenMainChat}
      onAutoOpenMainChatConsumed={consumeAutoOpenMain}
      onSelect={openConv}
      onRead={onRead}
      onOpenSettings={onOpenSettings}
      upcoming={upcoming}
      birthdayBannerDismissed={birthdayBannerDismissed}
      birthdayBannerClosing={birthdayBannerClosing}
      onDismissBirthdayBanner={onDismissBirthdayBanner}
      onOpenBirthdays={onOpenBirthdays}
      pushSupported={push.supported}
      pushSubscribed={push.subscribed}
      pushPermission={push.permission}
      pushToggling={push.toggling}
      onPushToggle={push.toggle}
      pinnedGroupId={pinnedGroupId}
      onPinGroup={setPinnedGroupId}
    />
  )
}
