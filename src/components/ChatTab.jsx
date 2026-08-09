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

  // Prevent window.scrollY from drifting. Skip the reset when the keyboard is
  // open — at that point the chat container is sized via --vvh and the window
  // scroll is harmless; resetting it would fight iOS's own scroll-to-reveal.
  useEffect(() => {
    function resetScroll() {
      if (window.scrollY > 0 && !document.body.classList.contains('chat-keyboard-open')) {
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('scroll', resetScroll, { passive: true })
    return () => window.removeEventListener('scroll', resetScroll)
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

  const convListProps = {
    session,
    groupId,
    members,
    enterClass: listClass,
    autoOpenGroupChat,
    onAutoOpenConsumed: consumeAutoOpen,
    autoOpenMainChat,
    onAutoOpenMainChatConsumed: consumeAutoOpenMain,
    onSelect: openConv,
    onRead,
    onOpenSettings,
    upcoming,
    birthdayBannerDismissed,
    birthdayBannerClosing,
    onDismissBirthdayBanner,
    onOpenBirthdays,
    pushSupported: push.supported,
    pushSubscribed: push.subscribed,
    pushPermission: push.permission,
    pushToggling: push.toggling,
    onPushToggle: push.toggle,
    pinnedGroupId,
    onPinGroup: setPinnedGroupId,
    activeConvId: activeConv?.id ?? null,
  }

  return (
    /* Desktop: flex row — ConvList left panel + ChatView right panel
       Mobile: show ConvList OR ChatView, never both */
    <div className="lg:flex lg:h-[calc(var(--dvh)+var(--sat))] lg:overflow-hidden">
      {/* Conversation list panel */}
      <div className={`${activeConv ? 'hidden' : ''} lg:block lg:w-64 lg:shrink-0 lg:border-r lg:border-stone-200 lg:bg-white lg:overflow-y-auto lg:h-full`}>
        <ConversationList {...convListProps} />
      </div>

      {/* Chat area */}
      {activeConv ? (
        <div className="lg:flex-1 lg:overflow-hidden lg:min-w-0">
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
        </div>
      ) : (
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:bg-sunrise-50">
          <p className="text-sm text-stone-400">Select a conversation to start messaging</p>
        </div>
      )}
    </div>
  )
}
